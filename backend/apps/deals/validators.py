from __future__ import annotations

from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

MAX_INSURANCE_COMPANY_LOGO_SIZE = 2 * 1024 * 1024
ALLOWED_INSURANCE_COMPANY_LOGO_MIME_TYPES = {
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
}
SVG_DANGEROUS_TAGS = {"script", "foreignobject", "iframe", "object", "embed"}
SVG_ALLOWED_TAGS = {
    "svg",
    "defs",
    "g",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "lineargradient",
    "radialgradient",
    "stop",
    "clippath",
    "mask",
    "symbol",
    "use",
    "title",
    "desc",
    "text",
    "tspan",
}
SVG_NAMESPACE = "http://www.w3.org/2000/svg"


def _read_svg(uploaded_file) -> bytes:
    uploaded_file.seek(0)
    contents = uploaded_file.read()
    if b"<!doctype" in contents.lower() or b"<!entity" in contents.lower():
        raise ValidationError("SVG не должен содержать DOCTYPE или ENTITY.")
    return contents


def sanitize_insurance_company_svg(uploaded_file) -> bytes:
    """Strip executable and externally referenced content from an SVG logo."""

    contents = _read_svg(uploaded_file)
    root = ElementTree.parse(BytesIO(contents)).getroot()
    if root.tag != f"{{{SVG_NAMESPACE}}}svg":
        raise ValidationError("SVG должен использовать пространство имён SVG.")
    for parent in root.iter():
        for child in list(parent):
            tag = child.tag.rsplit("}", maxsplit=1)[-1].lower()
            if (
                not child.tag.startswith(f"{{{SVG_NAMESPACE}}}")
                or tag not in SVG_ALLOWED_TAGS
                or tag in SVG_DANGEROUS_TAGS
            ):
                parent.remove(child)
                continue
            for attribute, value in list(child.attrib.items()):
                attribute_name = attribute.rsplit("}", maxsplit=1)[-1].lower()
                value = value.strip().lower()
                if (
                    attribute_name.startswith("on")
                    or attribute_name == "style"
                    or (attribute_name in {"href", "src"} and not value.startswith("#"))
                    or ("url(" in value and "url(#" not in value)
                ):
                    del child.attrib[attribute]
    for attribute, value in list(root.attrib.items()):
        attribute_name = attribute.rsplit("}", maxsplit=1)[-1].lower()
        value = value.strip().lower()
        if (
            attribute_name.startswith("on")
            or attribute_name == "style"
            or (attribute_name in {"href", "src"} and not value.startswith("#"))
            or ("url(" in value and "url(#" not in value)
        ):
            del root.attrib[attribute]
    return ElementTree.tostring(root, encoding="utf-8", xml_declaration=True)


def validate_insurance_company_logo(uploaded_file) -> None:
    """Validate the size, type and content of an insurance company logo."""

    extension = Path(uploaded_file.name).suffix.lower()
    expected_mime_type = ALLOWED_INSURANCE_COMPANY_LOGO_MIME_TYPES.get(extension)
    if expected_mime_type is None:
        raise ValidationError("Загрузите логотип в формате PNG, WebP или SVG.")

    if uploaded_file.size > MAX_INSURANCE_COMPANY_LOGO_SIZE:
        raise ValidationError("Размер логотипа не должен превышать 2 МБ.")

    content_type = getattr(uploaded_file, "content_type", None) or getattr(
        getattr(uploaded_file, "file", None), "content_type", None
    )
    if content_type and content_type != expected_mime_type:
        raise ValidationError("MIME-тип логотипа не соответствует расширению файла.")

    try:
        uploaded_file.seek(0)
        if extension == ".svg":
            sanitize_insurance_company_svg(uploaded_file)
        else:
            with Image.open(uploaded_file) as image:
                expected_format = extension.removeprefix(".").upper()
                if image.format != expected_format:
                    raise ValidationError(
                        "Содержимое логотипа не соответствует расширению файла."
                    )
                image.verify()
    except (ElementTree.ParseError, UnidentifiedImageError, OSError) as error:
        raise ValidationError("Не удалось прочитать файл логотипа.") from error
    finally:
        uploaded_file.seek(0)
