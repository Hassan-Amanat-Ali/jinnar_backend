// const ROLES = {
//   BUYER: "buyer",
//   SELLER: "seller",
//   SUPPORT: "support",
//   SUPERVISOR: "supervisor",
//   REGIONAL_MANAGER: "regional_manager",
//   SUPER_ADMIN: "super_admin",
// };

// // Role hierarchy: lower number = higher privilege
// const roleHierarchy = {
//   [ROLES.SUPER_ADMIN]: 1,
//   [ROLES.REGIONAL_MANAGER]: 2,
//   [ROLES.SUPERVISOR]: 3,
//   [ROLES.SUPPORT]: 4,
//   [ROLES.SELLER]: 5,
//   [ROLES.BUYER]: 5,
// };

// /**
//  * Middleware to authorize users based on role.
//  * @param {string | string[]} requiredRoles - The minimum role(s) required to access the route.
//  */
// export const authorize = (requiredRoles) => {
//   return (req, res, next) => {
//     const userRole = req.user?.role;

//     if (!userRole || !roleHierarchy[userRole]) {
//       return res.status(403).json({ error: "Forbidden: Invalid user role." });
//     }

//     const roles = Array.isArray(requiredRoles)
//       ? requiredRoles
//       : [requiredRoles];
//     const userLevel = roleHierarchy[userRole];

//     const isAuthorized = roles.some((role) => userLevel <= roleHierarchy[role]);

//     if (!isAuthorized) {
//       return res
//         .status(403)
//         .json({
//           error:
//             "Forbidden: You do not have permission to perform this action.",
//         });
//     }

//     next();
//   };
// };
