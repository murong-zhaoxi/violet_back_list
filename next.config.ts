import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许局域网设备（手机/其他电脑）在开发模式下访问，否则跨域 dev 资源会被阻止，
  // 导致前端 JS 不加载、注册/登录按钮无反应
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "172.19.48.1",
    "192.168.145.1",
    "*.local",
  ],
};

export default nextConfig;
