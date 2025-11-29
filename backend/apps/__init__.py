"""Package namespace extension that allows apps subpackages to be spread-out."""
__path__ = __import__("pkgutil").extend_path(__path__, __name__)
