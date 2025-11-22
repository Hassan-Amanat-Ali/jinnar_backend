// Middleware: IP allowlist (CIDR support for IPv4)
// Usage: import and call with array of CIDR strings or rely on env PAWAPAY_ALLOWED_IPS

function ipToLong(ip) {
  return (
    ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0
  );
}

function cidrContains(cidr, ip) {
  const [range, bits = "32"] = cidr.split("/");
  const mask = ~(2 ** (32 - Number(bits)) - 1) >>> 0;
  const ipLong = ipToLong(ip);
  const rangeLong = ipToLong(range);
  return (ipLong & mask) === (rangeLong & mask);
}

export default function ipAllowlist(allowed = null) {
  // allowed: array of CIDR strings
  const envList =
    process.env.PAWAPAY_ALLOWED_IPS || "3.64.89.224/32,110.39.11.3/32";
  const cidrs =
    Array.isArray(allowed) && allowed.length
      ? allowed
      : envList
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  return (req, res, next) => {
    // prefer X-Forwarded-For (first entry is client IP)
    const xff =
      req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"];
    let clientIp = null;
    if (xff) {
      clientIp = String(xff).split(",")[0].trim();
    } else if (req.ip) {
      clientIp = req.ip;
      // when req.ip is like ::ffff:127.0.0.1, strip IPv6 prefix
      if (clientIp.includes(":")) {
        const parts = clientIp.split(":");
        clientIp = parts[parts.length - 1];
      }
    }

    if (!clientIp) {
      return res.status(403).json({ error: "IP not found" });
    }

    // only IPv4 CIDRs supported here
    const allowedMatch = cidrs.some((c) => {
      try {
        return cidrContains(c, clientIp);
      } catch (e) {
        return false;
      }
    });

    if (!allowedMatch) {
      return res.status(403).json({ error: "IP not allowed" });
    }

    return next();
  };
}
