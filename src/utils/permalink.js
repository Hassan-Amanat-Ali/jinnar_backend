const normalizeSegment = (value) =>
  (value || "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const toSlug = (value, fallback = "item") => {
  const slug = normalizeSegment(value);
  return slug || fallback;
};

export const ensureUniqueSlug = (baseSlug, usedSlugsSet) => {
  if (!usedSlugsSet.has(baseSlug)) {
    usedSlugsSet.add(baseSlug);
    return baseSlug;
  }

  let counter = 2;
  let candidate = `${baseSlug}-${counter}`;
  while (usedSlugsSet.has(candidate)) {
    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }

  usedSlugsSet.add(candidate);
  return candidate;
};

export const normalizeCountryFromAddress = (address) => {
  if (!address || typeof address !== "string") return "";
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length ? parts[parts.length - 1] : "";
};

export const buildGigPermalink = ({ countrySlug, serviceSlug }) =>
  `/services/${countrySlug}/${serviceSlug}`;

export const buildBlogPermalink = (slug) => `/blog/${slug}`;

