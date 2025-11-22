export const validatePhoneNumber = (phone) => {
  return /^[+]?[\d\s-]{8,}$/.test(phone);
};

export const validateAmount = (amount) => {
  return typeof amount === "number" && amount > 0;
};

export const validateDepositRequest = (body) => {
  const { provider, amount, phoneNumber, country, currency } = body;
  if (!provider || !amount || !phoneNumber || !country || !currency) {
    return "Missing required fields";
  }
  if (!validateAmount(amount)) {
    return "Invalid amount";
  }
  if (!validatePhoneNumber(phoneNumber)) {
    return "Invalid phone number format";
  }
  // Add more validation (e.g., country, currency) if needed
  return null;
};

export const validatePayoutRequest = (body) => {
  const { provider, amount, phoneNumber, country, currency } = body;
  if (!provider || !amount || !phoneNumber || !country || !currency) {
    return "Missing required fields";
  }
  if (!validateAmount(amount)) {
    return "Invalid amount";
  }
  if (!validatePhoneNumber(phoneNumber)) {
    return "Invalid phone number format";
  }
  return null;
};

export const validateRefundRequest = (body) => {
  const { depositId, amount, reason } = body;
  if (!depositId || !amount || !reason) {
    return "Missing required fields";
  }
  if (!validateAmount(amount)) {
    return "Invalid amount";
  }
  return null;
};
