# 📋 备件计划清单（violet_back_list）

团队协作的**备件计划清单** Web 应用：创建备件计划清单、多人协作编辑、按权限共享、自动编号分组、评论讨论、Excel 导入导出。

## ✨ 功能特性

- **清单管理**：创建 / 编辑 / 删除备件计划清单，仪表盘总览
- **分组 + 自动编号**：清单内可划分多个分组（子清单），备件自动编号（如 `1.1`、`2.3`）
- **备件计划信息**：名称、型号/规格、需求数量、单位、负责人、状态（待采购 → 已采购 → 已到位 → 已完成 / 已取消）、备注
- **多人协作**：每 20 秒自动同步他人修改（准实时），另提供手动刷新按钮
- **共享与权限**：通过邮箱邀请成员，角色分**拥有者 / 可编辑 / 只读**，支持最后一名拥有者保护
- **评论讨论**：在每条备件下发表/删除评论，评论数实时显示
- **导入导出**：一键导出 Excel，支持 .xlsx / .csv 批量导入（自动建组、自动映射状态与负责人）
- **账号系统**：邮箱 + 密码注册 / 登录（bcrypt 加密存储）

## 🛠 技术栈

- **Next.js 16**（App Router）+ TypeScript + Tailwind CSS
- **Prisma 7** + SQLite（本地零配置，可平滑迁移 Postgres）
- **NextAuth v4**（Credentials + JWT）
- **SWR** 轮询实现准实时同步
- **SheetJS (xlsx)** 实现 Excel 导入导出

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库（生成 dev.db 与 Prisma Client）
npx prisma migrate dev

# 3. 配置环境变量（首次需要）
# 复制 .env 并填入：
#   DATABASE_URL="file:./prisma/dev.db"
#   AUTH_SECRET="<随机字符串，可用 openssl rand -hex 32 生成>"
#   NEXTAUTH_URL="http://localhost:3000"

# 4. 启动开发服务器
npm run dev
```

打开 http://localhost:3000 注册账号即可使用。

## 📦 项目结构

```
app/
  (auth)/            # 登录 / 注册页面
  api/
    auth/            # NextAuth 与注册接口
    lists/           # 清单 CRUD、分组、成员、导入导出
    items/           # 备件 CRUD、评论
    groups/          # 分组管理
    comments/        # 评论管理
  lists/[id]/        # 清单详情页
components/          # 仪表盘、清单详情、共享、评论等组件
lib/                 # Prisma 单例、NextAuth 配置、权限校验
prisma/schema.prisma # 数据模型
```

## 🔒 权限模型

| 角色 | 查看 | 编辑备件/分组 | 评论 | 管理成员 |
|------|------|--------------|------|---------|
| 拥有者 | ✅ | ✅ | ✅ | ✅ |
| 可编辑 | ✅ | ✅ | ✅ | ❌ |
| 只读 | ✅ | ❌ | ❌ | ❌ |

> 清单创建者自动成为「拥有者」；每份清单至少保留一名拥有者。

## 🧪 演示账号

开发环境中可自行注册账号体验协作功能（如 `a@test.com` 与 `b@test.com` 两个账号共享同一份清单，互相观察自动同步效果）。
