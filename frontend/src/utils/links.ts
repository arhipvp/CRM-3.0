const normalizePhoneDigits = (phone?: string | null): string | null => {
  if (!phone) {
    return null;
  }

  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly || null;
};

export const buildWhatsAppLink = (phone?: string | null): string | null => {
  const digitsOnly = normalizePhoneDigits(phone);
  return digitsOnly ? `https://wa.me/${digitsOnly}` : null;
};

export const buildTelegramLink = (phone?: string | null): string | null => {
  const digitsOnly = normalizePhoneDigits(phone);
  return digitsOnly ? `https://t.me/+${digitsOnly}` : null;
};

export const buildDriveFolderLink = (folderId?: string | null): string | null => {
  return folderId ? `https://drive.google.com/drive/folders/${folderId}` : null;
};

