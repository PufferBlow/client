import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"), // Default to home/marketing for web app
  route("/login", "routes/login.tsx"), // Explicit login route
  route("/signup", "routes/signup.tsx"),
  route("/dashboard", "routes/dashboard.tsx"),
  route("/m/:messageId", "routes/message.tsx"),
  route("/settings", "routes/settings.tsx"),
  route("/control-panel", "routes/control-panel.tsx"),
  route("*", "routes/not-found.tsx"), // Catch-all for static assets and invalid routes
] satisfies RouteConfig;
