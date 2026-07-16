# SimuTrans Pro - 实时多机同声传译系统

SimuTrans Pro 是一个先进的、高保真度的多手机跨屏同声传译系统。本系统包含一个基于 **Node.js Express & WebSockets** 驱动的实时后端，以及一个利用 **React, TypeScript 和 TailwindCSS** 构建的移动端拟真前台展示区。

---

## 🌟 核心特性

1. **虚拟多机实验室 (Virtual Multi-Phone Lab)**：
   - 允许在单屏上同时模拟并操控 3+ 台智能手机设备（支持 Host iPhone 15、Galaxy S24、Yuki's iPhone 等）。
   - 让您不依赖任何额外硬件，即可单机直接观察并验证多设备 WebSocket 广播与翻译效果。

2. **独立真实多机联机 (Single Mobile View)**：
   - 支持真正的分布式跨设备对话。任何人通过扫描生成的二维码，或点击专属 Deep Link，即可通过各自的手机加入群组。

3. **双目标语同传支持**：
   - 每个接收端均可自主定义：默认发言语种、主接收语种、次接收语种。
   - 任意成员发言后，接收端会同步接收并自动高精度同传为多国译文，并提供一键 TTS 语音朗读。

4. **快捷面对面组群**：
   - 模拟 **iPhone ↔ iPhone** 利用 AirDrop 进行快捷邻近建群。
   - 模拟 **Android ↔ Android** 通过 NFC 碰一碰一键建立群组。

---

## 🚀 启动步骤

### 1. 安装项目依赖
```bash
npm install --legacy-peer-deps
```

### 2. 构建前端静态资源 (Vite)
```bash
npm run build
```

### 3. 运行实时后端服务器
```bash
npm run server
```
启动后，系统会运行在本地的 `http://localhost:3000`。打开此页面即可开启翻译世界。

---

## 🧪 运行自动化测试与端到端验证

本系统配套了基于 **Playwright** 的端到端多机联合仿真测试脚本，可在后台模拟完整的“创建房间 -> NFC快速加入 -> Host中文发言 -> Guest1/Guest2各自收到并自动翻译成不同外语 (西班牙语、英语) -> 捕获运行截图”的完整链路。

### 1. 安装 Playwright
```bash
pip install playwright
# 或在 node 环境下使用: npx playwright install
```

### 2. 启动本地服务 (若未启动)
```bash
node server.js &
```

### 3. 执行测试脚本并捕获截图
运行内置的 Python 自动化验证脚本：
```bash
python3 /home/jules/verification/verify_trans.py
```

执行后，将在 `/home/jules/verification/` 目录下为您自动生成 3 张多机协同运行的高清晰度截图：
- `01_landing.png`：进入翻译 App 的初始着陆页面。
- `02_invitation_modal.png`：主机端动态生成并显示的同传邀请二维码 (QR Code) 及 Deep Link 链接。
- `03_translation_active.png`：多手机并列沙盒下的实时多人跨语言会话流（带有独立配置的西班牙语、英语二次同步翻译与一键音频重播按钮）。
