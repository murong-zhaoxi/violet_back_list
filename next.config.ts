import type { NextConfig } from "next";
import os from "node:os";

// 自动收集本机所有局域网 IPv4 地址，避免手机/局域网设备访问时
// 因电脑 IP 变化（DHCP）不在白名单而被 Next.js 阻止 dev 资源加载
function getLanIPs(): string[] {
  const ips: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

const nextConfig: NextConfig = {
  // 允许所有本机局域网 IP + 常用回环地址在开发模式下访问，
  // 否则跨域 dev 资源会被阻止，导致前端 JS 不加载、登录/注册异常
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.local", ...getLanIPs()],
};

export default nextConfig;
