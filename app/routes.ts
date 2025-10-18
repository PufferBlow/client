import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("/download", "routes/download.tsx"),
  route("/login", "routes/login.tsx"),
  route("/signup", "routes/signup.tsx"),
  route("/dashboard", "routes/dashboard.tsx"),
  route("/m/:messageId", "routes/message.tsx"),
  route("/settings", "routes/settings.tsx"),
  route("/control-panel", "routes/control-panel.tsx"),
] satisfies RouteConfig;
