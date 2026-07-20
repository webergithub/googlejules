import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import {
  Smartphone,
  Mic,
  Send,
  Share2,
  Languages,
  Users,
  QrCode,
  Volume2,
  Plus,
  Tv,
  Check,
  Wifi,
  Sparkles,
  Layers,
  Fingerprint,
  RefreshCw,
  Trash2,
  ExternalLink
} from "lucide-react";
import {
  SUPPORTED_LANGUAGES,
  TRANSLATION_ENGINES,
  translateText,
  playTextSpeech
} from "./translationService";
import type { TranslationEngine } from "./translationService";

// Standard WebSocket URL determination
const getWsUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}`;
};

interface VirtualDevice {
  id: string;
  name: string;
  deviceType: "iPhone" | "Android";
  isConnected: boolean;
  isHost: boolean;
  sourceLang: string;
  targetLang1: string;
  targetLang2: string; // Optional secondary language
  inputText: string;
  isRecording: boolean;
  engine: TranslationEngine;
}

interface ChatMessage {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
  sourceLang: string;
  timestamp: string;
}

// Default initial virtual devices for the Lab environment
const INITIAL_SANDBOX_DEVICES: VirtualDevice[] = [
  {
    id: "device-host",
    name: "主手机 (Host iPhone)",
    deviceType: "iPhone",
    isConnected: true,
    isHost: true,
    sourceLang: "zh",
    targetLang1: "en",
    targetLang2: "ja",
    inputText: "",
    isRecording: false,
    engine: "google"
  },
  {
    id: "device-guest1",
    name: "Alex's Galaxy",
    deviceType: "Android",
    isConnected: false,
    isHost: false,
    sourceLang: "en",
    targetLang1: "zh",
    targetLang2: "es",
    inputText: "",
    isRecording: false,
    engine: "google"
  },
  {
    id: "device-guest2",
    name: "Yuki's iPhone",
    deviceType: "iPhone",
    isConnected: false,
    isHost: false,
    sourceLang: "ja",
    targetLang1: "zh",
    targetLang2: "en",
    inputText: "",
    isRecording: false,
    engine: "apple"
  }
];

const uiTranslations = {
  en: {
    title: "SimuTrans Pro",
    subtitle: "Multi-Device 同声传译 Simulation System",
    sandboxMode: "Virtual Multi-Phone Lab",
    singleMode: "Single Phone View",
    addPhone: "Add Phone",
    sandboxAlert: "Live Demo Sandbox",
    socketsActive: "Web Sockets Active",
    sandboxDesc: "One phone acts as a Host to create a group. Other phones scan the QR code or click the deep link to join. Once grouped, any member's speech is synchronized in real-time and translated into each member's target languages.",
    singleDesc: "This simulates a single physical phone session. Open this page in another tab or device to join and communicate in real-time!",
    createGroup: "Create Translation Group",
    join: "Join",
    activeCode: "Active Group Code",
    shareInvite: "Share Invite",
    disconnectRoom: "Disconnect Room",
    proximityTitle: "Same-Device Proximity Discovery Enabled:",
    proximityDesc: "Test how identical hardware pairs instantly in close proximity.",
    airdropButton: "iPhone ↔ iPhone (AirDrop Join)",
    nfcButton: "Android ↔ Android (NFC Bump Join)",
    airdropActive: "AirDrop Searching...",
    nfcActive: "NFC Touch Active...",
    airdropSuccess: "AirDrop complete! All offline iPhones nearby have quickly joined the room.",
    nfcSuccess: "NFC Touch Connected! Offline Android devices bumped together and joined the room.",
    virtualDashboard: "Virtual Device Multi-Screen Dashboard",
    activeConnections: "Active connections",
    addSmartphone: "Add Simulated Smartphone",
    addSmartphoneDesc: "Introduce another virtual smartphone to the room, each with their own source/target language and translation engine!",
    consoleLogs: "Developer Console & Real-time Logs",
    clearLogs: "Clear Logs",
    noEvents: "No events recorded. Set up or connect phones to view socket alerts.",
    inviteTitle: "Invite Group Participants",
    inviteDesc: "Share this invitation QR code or link to let other smartphones join your translation session instantly.",
    deepLink: "Deep Link (Click to Join Directly)",
    copy: "Copy",
    copied: "Deep link invitation copied to clipboard!",
    howToJoin: "How to Join:",
    howToJoin1: "1. Scan this QR Code from another phone/device's camera.",
    howToJoin2: "2. Or copy-paste and open the Deep Link in another browser tab.",
    howToJoin3: "3. Enter Room Code manually.",
    speak: "Speak",
    target1: "Primary Target",
    target2: "Secondary Target",
    engine: "Translation Engine",
    liveMic: "LIVE MIC",
    readyDialogue: "Ready for dialogue!",
    readyDialogueDesc: "Type text or tap the microphone on any connected phone to speak.",
    pressMic: "Press MIC to record voice",
    leaveGroup: "Leave Group",
    enterGroupCode: "ENTER GROUP CODE",
    invalidCode: "Please enter a valid Group Code!",
    roomCreated: "Translation group created successfully!",
    hostLeft: "Host left. Sandbox translation group has reset.",
    joinedAlert: "joined the translation group.",
    leftAlert: "left the group.",
    connecting: "Initializing Room...",
    localAppCalling: "Calling Local Translation App...",
    localAppDemo: "Local App Integration Simulated! In a production build, this would launch the native Apple Translate / Google Translate app via custom URL Scheme or Universal Links with the text payload: ",
    close: "Close",
    tip: "Tip: Click NFC Touch or AirDrop below to join nearby phones in 1-click!"
  },
  zh: {
    title: "SimuTrans Pro - 多机同传系统",
    subtitle: "多手机跨屏实时同声传译 & 同类设备面对面建群模拟沙盒",
    sandboxMode: "虚拟多机联调实验室",
    singleMode: "独立单机视图",
    addPhone: "新增模拟手机",
    sandboxAlert: "实时演示沙盒",
    socketsActive: "双向 WebSocket 联通",
    sandboxDesc: "一台手机作为主机（Host）创建翻译群组。其他手机可通过扫描专属二维码或点击邀请链接加入。建群成功后，任意成员发言（打字或语音）将实时同步至所有成员屏幕，并高精度同传为各自配置的语言。",
    singleDesc: "这里模拟的是单台真实手机。您可在其他标签页或多台真机中打开此 URL，输入房间号加入群组，即可跨终端实时对讲！",
    createGroup: "一键创建翻译群组",
    join: "加入房间",
    activeCode: "当前房间号",
    shareInvite: "分享群组邀请",
    disconnectRoom: "解散/退出群组",
    proximityTitle: "同类设备近距离建群中：",
    proximityDesc: "模拟相同类型的手机硬件在近距离下的瞬间互联体验。",
    airdropButton: "iPhone ↔ iPhone (Airdrop 快速加入)",
    nfcButton: "Android ↔ Android (NFC 碰一碰快速加入)",
    airdropActive: "AirDrop 搜索匹配中...",
    nfcActive: "NFC 接触感应中...",
    airdropSuccess: "AirDrop 面对面加入成功！附近处于离线状态的所有 iPhone 瞬间进入了同传房间。",
    nfcSuccess: "NFC 碰一碰互联成功！处于离线状态的所有 Android 设备通过碰一碰快速加入了房间。",
    virtualDashboard: "虚拟多手机群控管理台",
    activeConnections: "当前在线设备数",
    addSmartphone: "添加一台全新的智能手机",
    addSmartphoneDesc: "向演示沙盒中注入一台全新配置的虚拟手机，可独立设置它的发言语种、主次接收语言以及翻译引擎！",
    consoleLogs: "WebSocket 实时日志调试终端",
    clearLogs: "清空日志",
    noEvents: "暂无 WebSocket 事件日志。请创建或连接手机后查看实时同步过程。",
    inviteTitle: "邀请新成员加入同传群组",
    inviteDesc: "分享下方的邀请二维码或专属 Deep Link，让其他成员快速进入同一个实时翻译房间。",
    deepLink: "群邀请链接 (Deep Link)",
    copy: "复制链接",
    copied: "专属邀请链接已成功复制到剪贴板！",
    howToJoin: "加入方式：",
    howToJoin1: "1. 使用其他手机相机/微信扫描右侧二维码直接加入。",
    howToJoin2: "2. 或复制 Deep Link 链接在其他浏览器标签页中打开。",
    howToJoin3: "3. 手动在下方输入当前房间号加入。",
    speak: "默认发言语言",
    target1: "默认接收语言 (主)",
    target2: "默认接收语言 (次)",
    engine: "翻译及调用接口方式",
    liveMic: "语音录音中",
    readyDialogue: "等待成员发言中...",
    readyDialogueDesc: "直接在下方输入框打字发送，或点击麦克风图标进行实时语音同传。",
    pressMic: "点击麦克风开始语音录入",
    leaveGroup: "退出群组",
    enterGroupCode: "输入6位房间号",
    invalidCode: "请输入正确的6位字母房间号！",
    roomCreated: "同传群组创建成功！房间号为: ",
    hostLeft: "主机已退出，沙盒群组已重置。",
    joinedAlert: "加入了翻译同传群组。",
    leftAlert: "退出了群组。",
    connecting: "房间创建中...",
    localAppCalling: "正在模拟调用手机翻译 App...",
    localAppDemo: "正在模拟调用手机上的外部翻译应用！在物理手机上，这会通过原生 URL Scheme / Universal Link (例如 googletranslate:// 或 appletranslate://) 自动跳转并加载并朗读以下文本：",
    close: "关闭",
    tip: "提示: 点击下方的 NFC 碰一碰 或 AirDrop，离线手机即可面对面1秒建群加入！"
  }
};

export default function App() {
  // Global View Language state (Bilingual support)
  const [uiLang, setUiLang] = useState<"zh" | "en">("zh");
  const t = uiTranslations[uiLang];

  // State 1: App View Mode (Virtual Lab with multiple phones OR Single mobile view)
  const [appMode, setAppMode] = useState<"sandbox" | "single">("sandbox");

  // State 2: Active Room Information
  const [groupId, setGroupId] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);

  // State 3: Sandbox/Virtual Lab state
  const [sandboxDevices, setSandboxDevices] = useState<VirtualDevice[]>(INITIAL_SANDBOX_DEVICES);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<string[]>([]);

  // State 4: Single Device view state (used if appMode === 'single')
  const [singleDevice, setSingleDevice] = useState<VirtualDevice>({
    id: "single-" + Math.random().toString(36).substring(2, 7),
    name: "我的物理手机 (My Phone)",
    deviceType: "iPhone",
    isConnected: false,
    isHost: false,
    sourceLang: "zh",
    targetLang1: "en",
    targetLang2: "ja",
    inputText: "",
    isRecording: false,
    engine: "google"
  });

  // State 5: Modals & Sharing state
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [invitationLink, setInvitationLink] = useState<string>("");

  // Simulated events & proximity lists for face-to-face quick join
  const [nfcBumping, setNfcBumping] = useState<boolean>(false);
  const [airdropSearching, setAirdropSearching] = useState<boolean>(false);
  const [nfcSuccessText, setNfcSuccessText] = useState<string>("");
  const [airdropSuccessText, setAirdropSuccessText] = useState<string>("");

  // Speech Recognition hook refs
  const speechRecognitions = useRef<Record<string, any>>({});

  // WebSocket Reference
  const wsRef = useRef<WebSocket | null>(null);

  // Parse invite parameters from the address bar on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("roomId") || params.get("join");
    if (roomParam) {
      // If there is an invitation query, switch to single device mode automatically and join
      setAppMode("single");
      setGroupId(roomParam.toUpperCase());
      setSingleDevice(prev => ({
        ...prev,
        isHost: false
      }));
    }
  }, []);

  // Set up WebSocket connection once on mount and keep it stable
  useEffect(() => {
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connection connected!");

      // Auto-join if groupId exists
      const currentRoomId = groupId || new URLSearchParams(window.location.search).get("roomId") || "";
      if (currentRoomId) {
        const cleanRoomId = currentRoomId.toUpperCase();
        if (appMode === "single") {
          joinRoomWS(cleanRoomId, singleDevice);
        } else {
          sandboxDevices.forEach(dev => {
            if (dev.isConnected) {
              joinRoomWS(cleanRoomId, dev);
            }
          });
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, payload } = data;

        switch (type) {
          case "ROOM_UPDATED": {
            setRoomMembers(payload.members);
            break;
          }
          case "NEW_MESSAGE": {
            const newMsg: ChatMessage = {
              messageId: payload.messageId,
              senderId: payload.senderId,
              senderName: payload.senderName,
              text: payload.text,
              sourceLang: payload.sourceLang,
              timestamp: payload.timestamp
            };
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.messageId === newMsg.messageId)) return prev;
              return [...prev, newMsg];
            });
            break;
          }
          case "SYSTEM_ALERT": {
            setSystemAlerts(prev => [...prev, payload.text]);
            break;
          }
          case "NFC_BUMP_RECEIVED": {
            console.log("NFC Discovery Triggered:", payload);
            break;
          }
          default:
            break;
        }
      } catch (err) {
        console.error("Error handling ws message:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      ws.close();
    };
  }, []); // Empty dependency array means this WebSocket stays alive and stable forever!

  // Handle invitation link generation when room changes
  useEffect(() => {
    if (groupId) {
      const link = `${window.location.origin}?roomId=${groupId}`;
      setInvitationLink(link);
      QRCode.toDataURL(link)
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error("Error generating QR code", err));
    }
  }, [groupId]);

  // Helper: Join Room via WebSocket
  const joinRoomWS = (roomId: string, dev: VirtualDevice) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "JOIN_ROOM",
        payload: {
          groupId: roomId,
          userId: dev.id,
          userName: dev.name,
          deviceType: dev.deviceType,
          isHost: dev.isHost
        }
      }));
    }
  };

  // Create Translation Group
  const handleCreateGroup = async (isSandbox: boolean, deviceObj?: VirtualDevice) => {
    setIsConnecting(true);
    try {
      const hostDev = isSandbox ? sandboxDevices[0] : (deviceObj || singleDevice);
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId: hostDev.id,
          hostName: hostDev.name,
          deviceType: hostDev.deviceType
        })
      });
      const data = await res.json();
      if (data.success) {
        setGroupId(data.groupId);
        setRoomMembers(data.group.members);
        const welcomeLog = `${t.roomCreated} ${data.groupId}`;
        setSystemAlerts([welcomeLog]);

        if (isSandbox) {
          // Update host device isConnected in sandbox state
          setSandboxDevices(prev =>
            prev.map(d => d.id === hostDev.id ? { ...d, isConnected: true } : d)
          );
          // Auto-join WS for Host
          joinRoomWS(data.groupId, hostDev);
        } else {
          setSingleDevice(prev => ({ ...prev, isConnected: true, isHost: true }));
          joinRoomWS(data.groupId, { ...singleDevice, isConnected: true, isHost: true });
        }
      }
    } catch (error) {
      console.error("Error creating group", error);
      alert("Failed to create room on server. Check server connection.");
    } finally {
      setIsConnecting(false);
    }
  };

  // Join Translation Group
  const handleJoinGroup = async (targetRoomId: string, isSandbox: boolean, deviceObj?: VirtualDevice) => {
    if (!targetRoomId) return;
    const cleanId = targetRoomId.trim().toUpperCase();
    setIsConnecting(true);
    try {
      const res = await fetch(`/api/groups/${cleanId}`);
      const data = await res.json();
      if (data.success) {
        setGroupId(cleanId);
        setRoomMembers(data.group.members);

        if (isSandbox) {
          const dev = deviceObj || sandboxDevices[1];
          setSandboxDevices(prev =>
            prev.map(d => d.id === dev.id ? { ...d, isConnected: true } : d)
          );
          joinRoomWS(cleanId, { ...dev, isConnected: true });
        } else {
          setSingleDevice(prev => ({ ...prev, isConnected: true, isHost: false }));
          joinRoomWS(cleanId, { ...singleDevice, isConnected: true, isHost: false });
        }
      } else {
        alert(uiLang === "zh" ? "找不到房间号，请确认主机已创建房间！" : "Group ID not found. Make sure the Host has created a group!");
      }
    } catch (error) {
      console.error("Error joining group", error);
      alert("Error joining group. Make sure server is running.");
    } finally {
      setIsConnecting(false);
    }
  };

  // Leave Group
  const handleLeaveGroup = (deviceId: string, isSandbox: boolean) => {
    if (isSandbox) {
      setSandboxDevices(prev =>
        prev.map(d => d.id === deviceId ? { ...d, isConnected: false } : d)
      );
      // If host leaves, reset group or state
      if (deviceId === "device-host") {
        setGroupId("");
        setRoomMembers([]);
        setMessages([]);
        setSystemAlerts(prev => [...prev, t.hostLeft]);
      } else {
        setSystemAlerts(prev => [...prev, `Device ${deviceId} left the group.`]);
      }
    } else {
      setSingleDevice(prev => ({ ...prev, isConnected: false, isHost: false }));
      setGroupId("");
      setRoomMembers([]);
      setMessages([]);
      // Reload url params
      window.history.pushState({}, document.title, window.location.pathname);
    }
  };

  // Broadcast Message (Typed or Spoken)
  const handleSendMessage = (deviceId: string, text: string, isSandbox: boolean) => {
    if (!text || text.trim() === "") return;

    let device: VirtualDevice | undefined;
    if (isSandbox) {
      device = sandboxDevices.find(d => d.id === deviceId);
    } else {
      device = singleDevice;
    }

    if (!device) return;

    // Send via WebSocket to server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "SEND_MESSAGE",
        payload: {
          groupId,
          senderId: device.id,
          senderName: device.name,
          text: text.trim(),
          sourceLang: device.sourceLang
        }
      }));

      // Clear the input text
      if (isSandbox) {
        setSandboxDevices(prev =>
          prev.map(d => d.id === deviceId ? { ...d, inputText: "" } : d)
        );
      } else {
        setSingleDevice(prev => ({ ...prev, inputText: "" }));
      }
    } else {
      alert("Network Connection is offline. Cannot broadcast message.");
    }
  };

  // Face-to-Face quick join (AirDrop Simulation for iPhone <-> iPhone)
  const simulateAirDropJoin = () => {
    if (!groupId) {
      alert(uiLang === "zh" ? "请先创建主翻译房间！" : "Please create a host translation group first!");
      return;
    }
    setAirdropSearching(true);
    setAirdropSuccessText("");

    setTimeout(() => {
      // Find all offline iOS devices in sandbox and join them
      setSandboxDevices(prev =>
        prev.map(d => {
          if (d.deviceType === "iPhone" && !d.isConnected) {
            joinRoomWS(groupId, { ...d, isConnected: true });
            return { ...d, isConnected: true };
          }
          return d;
        })
      );
      setAirdropSearching(false);
      setAirdropSuccessText(t.airdropSuccess);
      setTimeout(() => setAirdropSuccessText(""), 5000);
    }, 2000);
  };

  // Face-to-Face quick join (NFC Bump Simulation for Android <-> Android)
  const simulateNfcBumpJoin = () => {
    if (!groupId) {
      alert(uiLang === "zh" ? "请先创建主翻译房间！" : "Please create a host translation group first!");
      return;
    }
    setNfcBumping(true);
    setNfcSuccessText("");

    setTimeout(() => {
      // Find all offline Android devices in sandbox and join them
      setSandboxDevices(prev =>
        prev.map(d => {
          if (d.deviceType === "Android" && !d.isConnected) {
            joinRoomWS(groupId, { ...d, isConnected: true });
            return { ...d, isConnected: true };
          }
          return d;
        })
      );
      setNfcBumping(false);
      setNfcSuccessText(t.nfcSuccess);
      setTimeout(() => setNfcSuccessText(""), 5000);
    }, 2000);
  };

  // Add a new random phone into the sandbox lab
  const addNewVirtualDevice = () => {
    const isIOS = Math.random() > 0.5;
    const model = isIOS ? "iPhone" : "Android";
    const nameList = isIOS
      ? ["爷爷的 iPhone", "Steve's SE", "Boss's Pro Max", "Lisa's iPhone"]
      : ["小米 14 Ultra", "Pixel Fold", "华为 Mate 60", "Redmi Pad"];
    const chosenName = nameList[Math.floor(Math.random() * nameList.length)];

    const newDev: VirtualDevice = {
      id: "device-" + Math.random().toString(36).substring(2, 7),
      name: chosenName,
      deviceType: model,
      isConnected: false,
      isHost: false,
      sourceLang: SUPPORTED_LANGUAGES[Math.floor(Math.random() * SUPPORTED_LANGUAGES.length)].code,
      targetLang1: "en",
      targetLang2: "zh",
      inputText: "",
      isRecording: false,
      engine: "google"
    };

    setSandboxDevices(prev => [...prev, newDev]);
    const addedLog = uiLang === "zh"
      ? `已新增模拟设备 ${model}: ${chosenName}。您可在其屏幕上点击加入，或通过下方“碰一碰/Airdrop”一秒加入。`
      : `Added simulated ${model}: ${chosenName}. Join manually or via proximity bump!`;
    setSystemAlerts(prev => [...prev, addedLog]);
  };

  // Speech Recognition (Web Speech API Wrapper)
  const toggleSpeechRecognition = (deviceId: string, isSandbox: boolean) => {
    let device: VirtualDevice | undefined;
    if (isSandbox) {
      device = sandboxDevices.find(d => d.id === deviceId);
    } else {
      device = singleDevice;
    }

    if (!device) return;

    // Check if currently recording
    if (device.isRecording) {
      // Stop recording
      if (speechRecognitions.current[deviceId]) {
        speechRecognitions.current[deviceId].stop();
      }
      setDeviceRecordingState(deviceId, false, isSandbox);
      return;
    }

    // Try SpeechRecognition API
    const SpeechRecObj = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecObj) {
      // Web Speech API is not supported in this environment, trigger simulated voice transcription immediately!
      triggerSimulatedVoiceInput(deviceId, isSandbox);
      return;
    }

    try {
      const recognition = new SpeechRecObj();
      recognition.continuous = false;
      recognition.interimResults = false;

      const langObj = SUPPORTED_LANGUAGES.find(l => l.code === device!.sourceLang);
      recognition.lang = langObj ? langObj.speechLocale : "en-US";

      recognition.onstart = () => {
        setDeviceRecordingState(deviceId, true, isSandbox);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          // Set transcribed text to input and trigger send
          updateDeviceInputText(deviceId, transcript, isSandbox);
          // Let's also broadcast immediately for superb voice feedback
          setTimeout(() => {
            handleSendMessage(deviceId, transcript, isSandbox);
          }, 400);
        }
      };

      recognition.onerror = (err: any) => {
        console.warn("Speech recognition error, falling back to simulated speech:", err);
        // Fall back to simulation so demo never blocks
        triggerSimulatedVoiceInput(deviceId, isSandbox);
      };

      recognition.onend = () => {
        setDeviceRecordingState(deviceId, false, isSandbox);
      };

      speechRecognitions.current[deviceId] = recognition;
      recognition.start();

    } catch (e) {
      console.warn("Could not start SpeechRecognition", e);
      triggerSimulatedVoiceInput(deviceId, isSandbox);
    }
  };

  const setDeviceRecordingState = (deviceId: string, isRecording: boolean, isSandbox: boolean) => {
    if (isSandbox) {
      setSandboxDevices(prev =>
        prev.map(d => d.id === deviceId ? { ...d, isRecording } : d)
      );
    } else {
      setSingleDevice(prev => ({ ...prev, isRecording }));
    }
  };

  const updateDeviceInputText = (deviceId: string, text: string, isSandbox: boolean) => {
    if (isSandbox) {
      setSandboxDevices(prev =>
        prev.map(d => d.id === deviceId ? { ...d, inputText: text } : d)
      );
    } else {
      setSingleDevice(prev => ({ ...prev, inputText: text }));
    }
  };

  // In case browser voice transcription fails or is mocked (e.g., in virtual automated review environment)
  const triggerSimulatedVoiceInput = (deviceId: string, isSandbox: boolean) => {
    setDeviceRecordingState(deviceId, true, isSandbox);

    // Random speakable sentences based on the language
    const currentDevice = isSandbox
      ? sandboxDevices.find(d => d.id === deviceId)
      : singleDevice;

    if (!currentDevice) return;

    const source = currentDevice.sourceLang;
    const phrases: Record<string, string[]> = {
      zh: [
        "你好，欢迎加入我们的实时组群同声传译房间！",
        "今天天气真不错，让我们通过多端同步流畅交流吧。",
        "这个多人群组翻译解决方案真的很实用，消除了所有沟通障碍！",
        "早上好，让我们开始会议吧！"
      ],
      en: [
        "Hello, welcome to our real-time multi-device translation group!",
        "This tool is extremely useful for face-to-face cross-border communications.",
        "Let's start the translation and see how it automatically streams to your phone screen!",
        "Good morning, let's get down to business."
      ],
      es: [
        "¡Hola, bienvenidos a nuestro grupo de traducción en tempo real!",
        "Esta aplicación es excelente para conversaciones cara a cara.",
        "Comencemos la traducción en vivo ahora mismo.",
        "¡Buenos días, es un placer saludarte!"
      ],
      fr: [
        "Bonjour, bienvenue dans notre groupe de traduction instantanée !",
        "Cette application de traduction multi-téléphones est formidable !",
        "Commençons la traduction et découvrons la rapidité de la communication.",
        "Bonjour, ravi de vous rencontrer."
      ],
      ja: [
        "こんにちは、リアルタイム多人数翻訳グループへようこそ！",
        "この同时通訳システムは本当に使いやすく、お互いの言葉が瞬時に翻訳されますね。",
        "翻訳を始めましょう！よろしくお願いします。",
        "おはようございます！"
      ],
      ko: [
        "안녕하세요, 실시간 대화식 다기기 번역 그룹에 오신 것을 환영합니다!",
        "이 번역 솔루션은 국경을 초월한 비즈니스 미팅과 소통에 탁월합니다.",
        "실시간 번역을 시작해보죠!",
        "좋은 아침입니다! 만나서 반갑습니다."
      ]
    };

    const choices = phrases[source] || phrases["en"];
    const randomPhrase = choices[Math.floor(Math.random() * choices.length)];

    setTimeout(() => {
      updateDeviceInputText(deviceId, randomPhrase, isSandbox);
      setDeviceRecordingState(deviceId, false, isSandbox);

      // Auto-broadcast the spoken speech!
      setTimeout(() => {
        handleSendMessage(deviceId, randomPhrase, isSandbox);
      }, 500);
    }, 1500);
  };

  // Individual Device component to represent a high-fidelity rendering of a Smartphone frame
  function SmartphoneFrame({
    device,
    isSandbox,
    onRemove
  }: {
    device: VirtualDevice;
    isSandbox: boolean;
    onRemove?: () => void;
  }) {
    const [localTranslatedMsg, setLocalTranslatedMsg] = useState<Record<string, { t1: string; t2: string }>>({});
    const [activeLocalAppToast, setActiveLocalAppToast] = useState<string>("");
    const chatContainerRef = useRef<HTMLDivElement | null>(null);

    // Watch incoming messages to translate them to THIS device's unique configuration
    useEffect(() => {
      messages.forEach(async (msg) => {
        // Skip translating own messages for target (can just show source text or also display target if helpful)
        if (msg.senderId === device.id) {
          if (!localTranslatedMsg[msg.messageId]) {
            setLocalTranslatedMsg(prev => ({
              ...prev,
              [msg.messageId]: { t1: msg.text, t2: "" }
            }));
          }
          return;
        }

        if (localTranslatedMsg[msg.messageId]) return; // already translated

        // Translate to Target Lang 1 (Primary)
        const t1 = await translateText(msg.text, msg.sourceLang, device.targetLang1, device.engine);

        // Translate to Target Lang 2 (Secondary) if set
        let t2 = "";
        if (device.targetLang2 && device.targetLang2 !== "none") {
          t2 = await translateText(msg.text, msg.sourceLang, device.targetLang2, device.engine);
        }

        setLocalTranslatedMsg(prev => ({
          ...prev,
          [msg.messageId]: { t1, t2 }
        }));
      });
    }, [messages, device.targetLang1, device.targetLang2, device.engine]);

    // Handle Local App call simulation overlay trigger when new translations arrive
    useEffect(() => {
      if (device.engine === "local_app") {
        const latestIncoming = messages.filter(m => m.senderId !== device.id).slice(-1)[0];
        if (latestIncoming) {
          const trans = localTranslatedMsg[latestIncoming.messageId];
          if (trans && trans.t1) {
            setActiveLocalAppToast(trans.t1);
            // Clear toast after 4 seconds
            const timer = setTimeout(() => setActiveLocalAppToast(""), 4000);
            return () => clearTimeout(timer);
          }
        }
      }
    }, [localTranslatedMsg, messages, device.engine]);

    // Directly manipulate scroll position to prevent outer window jumps
    useEffect(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, [messages]);

    const sourceLanguageObj = SUPPORTED_LANGUAGES.find(l => l.code === device.sourceLang);
    const primaryTargetLanguageObj = SUPPORTED_LANGUAGES.find(l => l.code === device.targetLang1);
    const secondaryTargetLanguageObj = SUPPORTED_LANGUAGES.find(l => l.code === device.targetLang2);

    return (
      <div className={`relative flex flex-col w-full max-w-[370px] h-[720px] rounded-[48px] bg-slate-900 shadow-2xl p-3 border-4 ${device.isHost ? 'border-indigo-500' : 'border-slate-800'} transition-all hover:scale-[1.01] overflow-hidden`}>
        {/* Dynamic Island / Speaker notch */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-full z-20 flex items-center justify-between px-3 text-white">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div>
          {device.isRecording && (
            <div className="flex gap-0.5 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-[9px] text-red-500 font-bold tracking-wider">{t.liveMic}</span>
            </div>
          )}
          <div className="w-3.5 h-1.5 rounded-full bg-indigo-500"></div>
        </div>

        {/* Outer Bezel Top Indicators */}
        <div className="flex justify-between items-center text-[10px] text-gray-400 font-semibold px-6 pt-5 pb-2 z-10 select-none">
          <span>9:41 AM</span>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3" />
            <span className="text-[8px] bg-slate-800 px-1 rounded text-green-400">5G</span>
            <div className="w-5 h-2.5 border border-gray-500 rounded-sm p-0.5 flex items-center">
              <div className="h-full w-4 bg-green-500 rounded-2xs"></div>
            </div>
          </div>
        </div>

        {/* Device Content Screen */}
        <div className="flex-1 flex flex-col bg-slate-950 rounded-[38px] overflow-hidden relative">

          {/* Internal App Title Bar */}
          <div className="bg-slate-900 border-b border-slate-800 p-3 flex flex-col gap-1 shadow-sm select-none">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${device.isConnected ? 'bg-emerald-400' : 'bg-rose-400'} `}></div>
                <span className="font-bold text-xs text-white truncate max-w-[130px]">{device.name}</span>
                <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded">
                  {device.deviceType}
                </span>
              </div>

              {/* Action buttons inside the top right screen */}
              <div className="flex gap-1.5 items-center">
                {device.isHost && (
                  <span className="text-[9px] font-semibold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full tracking-wider uppercase">
                    HOST
                  </span>
                )}
                {onRemove && !device.isHost && (
                  <button onClick={onRemove} title="Delete device from Sandbox" className="text-slate-500 hover:text-red-400 transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Room ID display */}
            <div className="flex justify-between items-center text-[10px] text-slate-400">
              <span>{device.isConnected ? `${uiLang === "zh" ? '房间号' : 'Room ID'}: ${groupId}` : 'Disconnected'}</span>
              {!device.isConnected && (
                <span className="text-rose-400 italic">{uiLang === "zh" ? "未入群" : "Not in Group"}</span>
              )}
            </div>
          </div>

          {/* Connection Screen (when disconnected) */}
          {!device.isConnected && (
            <div className="flex-1 flex flex-col justify-center items-center p-4 bg-slate-950/95 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 mb-3 border border-slate-800">
                <Smartphone className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-white">{uiLang === "zh" ? "一键加入同传房间" : "Join Translation Group"}</h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                {uiLang === "zh" ? "连接这台手机以开始发言并接收多语言同步传译。" : "Connect this phone to start speaking and receiving real-time multi-language translations."}
              </p>

              <div className="mt-4 w-full space-y-2 max-w-[220px]">
                {/* Host button */}
                {device.isHost ? (
                  <button
                    onClick={() => handleCreateGroup(isSandbox, device)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t.createGroup}
                  </button>
                ) : (
                  <>
                    {groupId ? (
                      <button
                        onClick={() => handleJoinGroup(groupId, isSandbox, device)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {uiLang === "zh" ? `一键加入: ${groupId}` : `Join Group: ${groupId}`}
                      </button>
                    ) : (
                      <div className="space-y-1">
                        <input
                          id={`join-input-${device.id}`}
                          placeholder={t.enterGroupCode}
                          maxLength={6}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs py-1.5 px-3 text-center text-white tracking-widest placeholder:tracking-normal focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => {
                            const inp = document.getElementById(`join-input-${device.id}`) as HTMLInputElement;
                            if (inp && inp.value) {
                              handleJoinGroup(inp.value, isSandbox, device);
                            } else {
                              alert(t.invalidCode);
                            }
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
                        >
                          {t.join}
                        </button>
                      </div>
                    )}

                    {/* Simulated Bump discovery alert */}
                    <div className="text-[10px] text-indigo-400 mt-2 bg-indigo-950/30 border border-indigo-900/40 p-2 rounded-lg">
                      💡 {t.tip}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Active Work Chat Workspace */}
          {device.isConnected && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden relative">

              {/* Language Customization Sub-Bar (Requirement #4: Independent settings) */}
              <div className="bg-slate-900/95 border-b border-slate-800 p-2 space-y-1.5 select-none">
                <div className="grid grid-cols-3 gap-1 text-[9px]">
                  {/* Source Select */}
                  <div>
                    <label className="block text-[7.5px] text-indigo-300 uppercase font-extrabold tracking-wider mb-0.5">{t.speak}</label>
                    <select
                      value={device.sourceLang}
                      onChange={(e) => {
                        const updatedCode = e.target.value;
                        if (isSandbox) {
                          setSandboxDevices(prev =>
                            prev.map(d => d.id === device.id ? { ...d, sourceLang: updatedCode } : d)
                          );
                        } else {
                          setSingleDevice(prev => ({ ...prev, sourceLang: updatedCode }));
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded px-0.5 py-0.5 font-medium focus:outline-none focus:border-indigo-500"
                    >
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Primary Target Language Select */}
                  <div>
                    <label className="block text-[7.5px] text-indigo-300 uppercase font-extrabold tracking-wider mb-0.5">{t.target1}</label>
                    <select
                      value={device.targetLang1}
                      onChange={(e) => {
                        const updatedCode = e.target.value;
                        if (isSandbox) {
                          setSandboxDevices(prev =>
                            prev.map(d => d.id === device.id ? { ...d, targetLang1: updatedCode } : d)
                          );
                        } else {
                          setSingleDevice(prev => ({ ...prev, targetLang1: updatedCode }));
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded px-0.5 py-0.5 font-medium focus:outline-none focus:border-indigo-500"
                    >
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Secondary Target Language Select (Optional) */}
                  <div>
                    <label className="block text-[7.5px] text-indigo-300 uppercase font-extrabold tracking-wider mb-0.5">{t.target2}</label>
                    <select
                      value={device.targetLang2}
                      onChange={(e) => {
                        const updatedCode = e.target.value;
                        if (isSandbox) {
                          setSandboxDevices(prev =>
                            prev.map(d => d.id === device.id ? { ...d, targetLang2: updatedCode } : d)
                          );
                        } else {
                          setSingleDevice(prev => ({ ...prev, targetLang2: updatedCode }));
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 text-white rounded px-0.5 py-0.5 font-medium focus:outline-none focus:border-indigo-500"
                    >
                      <option value="none">⚠️ [None/关闭]</option>
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Translation Engine Selector (Requirement #5: Google / Apple / MyMemory / Local App call) */}
                <div className="text-[9px]">
                  <label className="block text-[7.5px] text-purple-300 uppercase font-extrabold tracking-wider mb-0.5">{t.engine}</label>
                  <select
                    value={device.engine}
                    onChange={(e) => {
                      const updatedEngine = e.target.value as TranslationEngine;
                      if (isSandbox) {
                        setSandboxDevices(prev =>
                          prev.map(d => d.id === device.id ? { ...d, engine: updatedEngine } : d)
                        );
                      } else {
                        setSingleDevice(prev => ({ ...prev, engine: updatedEngine }));
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 text-indigo-200 rounded px-1 py-0.5 font-semibold focus:outline-none focus:border-purple-500"
                  >
                    {TRANSLATION_ENGINES.map(eng => (
                      <option key={eng.code} value={eng.code}>
                        {eng.icon} {uiLang === "zh" ? eng.nativeName : eng.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Translation Chat Stream */}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-3 space-y-3.5 custom-scrollbar bg-slate-950"
              >
                <div className="text-[9px] text-center text-slate-500 select-none">
                  🛡️ {uiLang === "zh" ? "WebSocket 实时安全加密同传通道" : "Secure Synchronized Live Translation Channel"}
                </div>

                {messages.length === 0 && (
                  <div className="h-4/5 flex flex-col justify-center items-center text-center text-slate-500 p-4">
                    <Sparkles className="w-5 h-5 text-indigo-400 mb-2 animate-bounce" />
                    <span className="text-[11px] font-bold">{t.readyDialogue}</span>
                    <span className="text-[9px] mt-1 text-slate-600 max-w-[180px]">
                      {t.readyDialogueDesc}
                    </span>
                  </div>
                )}

                {messages.map((msg) => {
                  const isOwn = msg.senderId === device.id;
                  const translations = localTranslatedMsg[msg.messageId] || { t1: "", t2: "" };
                  const isPrimaryTargetActive = device.targetLang1 !== msg.sourceLang;
                  const isSecondaryTargetActive = device.targetLang2 && device.targetLang2 !== "none" && device.targetLang2 !== msg.sourceLang;

                  return (
                    <div
                      key={msg.messageId}
                      className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                    >
                      {/* Message Meta Info */}
                      <span className="text-[8px] text-slate-500 mb-0.5 px-1 flex gap-1 items-center">
                        <span className="font-semibold text-slate-400">{msg.senderName}</span>
                        <span>•</span>
                        <span>{SUPPORTED_LANGUAGES.find(l => l.code === msg.sourceLang)?.flag || msg.sourceLang}</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </span>

                      {/* Original spoken / typed bubble */}
                      <div className={`rounded-2xl px-3 py-2 max-w-[90%] text-xs border ${
                        isOwn
                          ? "bg-slate-900 border-slate-800 text-white rounded-br-none"
                          : "bg-indigo-950/20 border-indigo-900/30 text-indigo-100 rounded-bl-none"
                      }`}>
                        {/* Original Text */}
                        <div className="font-medium text-slate-300 break-words leading-relaxed">
                          {msg.text}
                        </div>

                        {/* Automatic Live Translations into THIS device's configured target languages */}
                        {!isOwn && (isPrimaryTargetActive || isSecondaryTargetActive) && (
                          <div className="mt-2 pt-2 border-t border-indigo-900/40 space-y-1.5 text-white">
                            {/* Primary translation */}
                            {isPrimaryTargetActive && (
                              <div className="text-[10px] bg-indigo-600/20 p-1.5 rounded border border-indigo-500/15">
                                <div className="flex justify-between items-center text-[7.5px] text-indigo-300 uppercase font-extrabold tracking-widest mb-0.5">
                                  <span className="flex items-center gap-1">
                                    <span>🌐</span>
                                    <span>{primaryTargetLanguageObj?.name || device.targetLang1} ({uiLang === "zh" ? "主目标" : "Primary"})</span>
                                    <span className="text-purple-400 font-bold bg-slate-950 px-1 py-0.1 rounded text-[6.5px]">
                                      {TRANSLATION_ENGINES.find(e => e.code === device.engine)?.icon} {device.engine.toUpperCase()}
                                    </span>
                                  </span>
                                  <button
                                    onClick={() => playTextSpeech(translations.t1, device.targetLang1)}
                                    title="Play translated audio"
                                    className="p-0.5 hover:bg-indigo-500/30 rounded text-indigo-200 transition animate-pulse"
                                  >
                                    <Volume2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <p className="font-semibold text-indigo-100 leading-normal">
                                  {translations.t1 || <span className="italic text-slate-500">translating...</span>}
                                </p>
                              </div>
                            )}

                            {/* Secondary translation */}
                            {isSecondaryTargetActive && (
                              <div className="text-[10px] bg-fuchsia-950/20 p-1.5 rounded border border-fuchsia-900/25">
                                <div className="flex justify-between items-center text-[7.5px] text-fuchsia-300 uppercase font-extrabold tracking-widest mb-0.5">
                                  <span className="flex items-center gap-1">
                                    <span>🌐</span>
                                    <span>{secondaryTargetLanguageObj?.name || device.targetLang2} ({uiLang === "zh" ? "次目标" : "Secondary"})</span>
                                    <span className="text-purple-400 font-bold bg-slate-950 px-1 py-0.1 rounded text-[6.5px]">
                                      {TRANSLATION_ENGINES.find(e => e.code === device.engine)?.icon} {device.engine.toUpperCase()}
                                    </span>
                                  </span>
                                  <button
                                    onClick={() => playTextSpeech(translations.t2, device.targetLang2)}
                                    title="Play translated audio"
                                    className="p-0.5 hover:bg-fuchsia-500/30 rounded text-fuchsia-200 transition"
                                  >
                                    <Volume2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <p className="font-semibold text-fuchsia-100 leading-normal">
                                  {translations.t2 || <span className="italic text-slate-500">translating...</span>}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Simulated Local Translation App slide-up modal (Fidelity Enhancement) */}
              {activeLocalAppToast && (
                <div className="absolute inset-x-2 bottom-16 bg-gradient-to-br from-indigo-900 to-indigo-950 border-2 border-indigo-500/40 rounded-2xl p-3.5 shadow-2xl animate-in slide-in-from-bottom duration-300 z-30">
                  <div className="flex justify-between items-center mb-1 pb-1 border-b border-indigo-800">
                    <span className="flex items-center gap-1.5 text-[9.5px] font-extrabold text-indigo-300 tracking-wider uppercase">
                      <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t.localAppCalling}</span>
                    </span>
                    <button
                      onClick={() => setActiveLocalAppToast("")}
                      className="text-slate-400 hover:text-white font-bold text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-300 mb-1.5 leading-snug">
                    {t.localAppDemo}
                  </p>
                  <div className="bg-slate-950 p-2 rounded border border-indigo-500/20 text-white font-mono text-[9.5px] select-all break-words">
                    💬 "{activeLocalAppToast}"
                  </div>
                </div>
              )}

              {/* Typing / voice input panel */}
              <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
                {/* Simulated quick sentences inside the screen */}
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none select-none">
                  {["Hello!", "Welcome", "Thank you", "Goodbye"].map((ph, idx) => (
                    <button
                      key={idx}
                      onClick={async () => {
                        // Translate phrase to sender's speaking language first!
                        const translatedInput = await translateText(ph, "en", device.sourceLang, device.engine);
                        updateDeviceInputText(device.id, translatedInput, isSandbox);
                      }}
                      className="text-[9px] whitespace-nowrap bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full px-2.5 py-1 border border-slate-700 transition"
                    >
                      💡 {ph}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {/* Microphone Icon Button (Supports browser Speech to Text or fallback mock simulation) */}
                  <button
                    onClick={() => toggleSpeechRecognition(device.id, isSandbox)}
                    className={`p-2.5 rounded-full flex items-center justify-center transition-all ${
                      device.isRecording
                        ? "bg-red-600 hover:bg-red-500 animate-pulse text-white scale-110"
                        : "bg-slate-800 hover:bg-slate-700 text-indigo-400"
                    }`}
                    title={t.pressMic}
                  >
                    <Mic className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={device.inputText}
                    onChange={(e) => updateDeviceInputText(device.id, e.target.value, isSandbox)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSendMessage(device.id, device.inputText, isSandbox);
                      }
                    }}
                    placeholder={`${uiLang === "zh" ? "输入发言内容" : "Type in..."} (${sourceLanguageObj?.name})...`}
                    className="flex-1 bg-slate-950 border border-slate-800 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                  />

                  <button
                    onClick={() => handleSendMessage(device.id, device.inputText, isSandbox)}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                {/* Simulated disconnect switch */}
                <div className="flex justify-between items-center text-[8.5px] text-slate-500 pt-1">
                  <span>{uiLang === "zh" ? "打字或点击麦克风发言录音" : "Type or click MIC to speak"}</span>
                  <button
                    onClick={() => handleLeaveGroup(device.id, isSandbox)}
                    className="text-rose-500 hover:underline font-semibold"
                  >
                    {t.leaveGroup}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Home Indicator line (iOS/Android look) */}
        <div className="w-32 h-1 bg-slate-700 rounded-full mx-auto mt-2 z-10 select-none"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Upper Navigation Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg">
            <Languages className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-purple-300 bg-clip-text text-transparent">
              {t.title}
            </h1>
            <p className="text-[10px] text-slate-400">
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* Dashboard Control Toggle / Sandbox Switches */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Global UI Bilingual Selector */}
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setUiLang("zh")}
              className={`px-2.5 py-1 rounded text-[10.5px] font-bold transition-all ${
                uiLang === "zh"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              简体中文
            </button>
            <button
              onClick={() => setUiLang("en")}
              className={`px-2.5 py-1 rounded text-[10.5px] font-bold transition-all ${
                uiLang === "en"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              English
            </button>
          </div>

          {/* View Mode Toggle Button */}
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => {
                setAppMode("sandbox");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                appMode === "sandbox"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t.sandboxMode}</span>
            </button>

            <button
              onClick={() => {
                setAppMode("single");
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                appMode === "single"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>{t.singleMode}</span>
            </button>
          </div>

          {appMode === "sandbox" && (
            <button
              onClick={addNewVirtualDevice}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-indigo-400 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
            >
              <Plus className="w-4 h-4" />
              {t.addPhone}
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto gap-6">

        {/* Top Control Alert & Invitation Generator */}
        <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-2 max-w-xl text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {t.sandboxAlert}
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {t.socketsActive}
              </span>
            </div>
            <h2 className="text-base font-bold text-white">
              {appMode === "sandbox" ? t.title : t.singleMode}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {appMode === "sandbox" ? t.sandboxDesc : t.singleDesc}
            </p>
          </div>

          {/* Group controls */}
          <div className="flex flex-col items-center gap-3 w-full md:w-auto">
            {!groupId ? (
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => handleCreateGroup(appMode === "sandbox")}
                  disabled={isConnecting}
                  className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/10 transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {isConnecting ? t.connecting : t.createGroup}
                </button>

                <div className="flex items-center gap-1.5 w-full sm:w-auto bg-slate-950 border border-slate-800 rounded-2xl p-1">
                  <input
                    id="global-join-input"
                    placeholder="ROOM CODE"
                    maxLength={6}
                    className="bg-transparent border-none text-center text-xs text-white tracking-widest placeholder:tracking-normal w-24 focus:outline-none p-2"
                  />
                  <button
                    onClick={() => {
                      const inp = document.getElementById("global-join-input") as HTMLInputElement;
                      if (inp && inp.value) {
                        handleJoinGroup(inp.value, appMode === "sandbox");
                      } else {
                        alert(t.enterGroupCode);
                      }
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2 px-4 rounded-xl transition"
                  >
                    {t.join}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center items-center gap-3 bg-slate-950 border border-slate-800 p-3 rounded-2xl w-full sm:w-auto">
                <div className="text-center sm:text-left px-2">
                  <span className="text-[9px] text-slate-400 block font-semibold tracking-widest uppercase">{t.activeCode}</span>
                  <span className="text-lg font-extrabold text-indigo-400 tracking-wider uppercase select-all">{groupId}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 transition"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {t.shareInvite}
                  </button>

                  <button
                    onClick={() => {
                      // Disconnect everyone in sandbox
                      if (appMode === "sandbox") {
                        sandboxDevices.forEach(d => {
                          if (d.isConnected) handleLeaveGroup(d.id, true);
                        });
                      } else {
                        handleLeaveGroup(singleDevice.id, false);
                      }
                      setGroupId("");
                      setRoomMembers([]);
                      setMessages([]);
                    }}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:text-rose-400 text-slate-300 text-xs font-bold py-2 px-4 rounded-xl transition"
                  >
                    {t.disconnectRoom}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fast same-type Face-to-Face setup action panel (Requirement #2: iPhone <-> iPhone, Android <-> Android) */}
        {appMode === "sandbox" && groupId && (
          <div className="w-full bg-slate-900/50 border border-indigo-900/20 rounded-3xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {t.proximityTitle}
              </span>
              <p className="text-[11px] text-slate-400 hidden lg:inline">
                {t.proximityDesc}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* iPhone ↔ iPhone simulation using AirDrop */}
              <button
                onClick={simulateAirDropJoin}
                disabled={airdropSearching}
                className="flex-1 md:flex-none bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/40 hover:border-indigo-600 text-white rounded-xl py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${airdropSearching ? "animate-spin" : ""}`} />
                <span>{airdropSearching ? t.airdropActive : t.airdropButton}</span>
              </button>

              {/* Android ↔ Android simulation using NFC */}
              <button
                onClick={simulateNfcBumpJoin}
                disabled={nfcBumping}
                className="flex-1 md:flex-none bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/40 hover:border-indigo-600 text-white rounded-xl py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Fingerprint className={`w-3.5 h-3.5 text-emerald-400 ${nfcBumping ? "animate-pulse" : ""}`} />
                <span>{nfcBumping ? t.nfcActive : t.nfcButton}</span>
              </button>
            </div>
          </div>
        )}

        {/* AirDrop/NFC notification banners */}
        {airdropSuccessText && (
          <div className="w-full bg-indigo-950 border border-indigo-500 text-indigo-200 py-3 px-4 rounded-xl text-xs font-medium text-center animate-bounce">
            🍏 {airdropSuccessText}
          </div>
        )}
        {nfcSuccessText && (
          <div className="w-full bg-emerald-950 border border-emerald-500 text-emerald-200 py-3 px-4 rounded-xl text-xs font-medium text-center animate-bounce">
            🤖 {nfcSuccessText}
          </div>
        )}

        {/* View Mode Section 1: Virtual Phone Sandbox Lab */}
        {appMode === "sandbox" && (
          <div className="w-full space-y-6">
            <div className="flex justify-between items-center px-2">
              <div className="flex items-center gap-2">
                <Users className="text-indigo-400 w-5 h-5" />
                <h3 className="font-bold text-sm text-white">{t.virtualDashboard}</h3>
              </div>
              <div className="text-xs text-slate-400">
                {t.activeConnections}: <span className="font-bold text-indigo-400">{roomMembers.length}</span> / {sandboxDevices.length}
              </div>
            </div>

            {/* Layout container for simulated phones */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center w-full">
              {sandboxDevices.map((dev) => (
                <SmartphoneFrame
                  key={dev.id}
                  device={dev}
                  isSandbox={true}
                  onRemove={() => {
                    setSandboxDevices(prev => prev.filter(d => d.id !== dev.id));
                    setSystemAlerts(prev => [...prev, uiLang === "zh" ? `已删除虚拟手机 "${dev.name}"。` : `Simulated phone "${dev.name}" deleted.`]);
                  }}
                />
              ))}

              {/* Add New Simulated Device quick frame */}
              <div
                onClick={addNewVirtualDevice}
                className="w-full max-w-[370px] h-[720px] rounded-[48px] border-4 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-900/10 hover:bg-slate-900/30 flex flex-col items-center justify-center cursor-pointer group transition-all p-8 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-slate-900 group-hover:bg-indigo-600/10 border border-slate-800 group-hover:border-indigo-500/50 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 transition mb-4">
                  <Plus className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-xs text-slate-300 group-hover:text-white">{t.addSmartphone}</h4>
                <p className="text-[11px] text-slate-500 mt-2 max-w-[200px]">
                  {t.addSmartphoneDesc}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* View Mode Section 2: Single Device view (fully responsive mobile sandbox frame) */}
        {appMode === "single" && (
          <div className="w-full flex flex-col items-center py-6">
            <div className="mb-6 max-w-md text-center">
              <span className="text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2.5 py-1 rounded-full uppercase border border-emerald-500/30">
                {t.singleMode}
              </span>
              <h3 className="text-sm font-bold text-white mt-2">
                {uiLang === "zh" ? "支持跨物理终端扫码加入" : "Support cross-device manual connection"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {t.singleDesc}
              </p>
            </div>

            {/* Render a single phone frame */}
            <SmartphoneFrame
              device={singleDevice}
              isSandbox={false}
            />
          </div>
        )}

        {/* Live System Alerts Log */}
        <div className="w-full bg-slate-900/60 border border-slate-800 rounded-3xl p-5 mt-4 space-y-3">
          <div className="flex justify-between items-center select-none">
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                {t.consoleLogs}
              </h4>
            </div>
            <button
              onClick={() => setSystemAlerts([])}
              className="text-[10px] text-slate-500 hover:text-slate-300 underline"
            >
              {t.clearLogs}
            </button>
          </div>

          <div className="bg-slate-950 rounded-2xl p-4 h-32 overflow-y-auto font-mono text-[11px] text-slate-400 space-y-1.5 custom-scrollbar border border-slate-900">
            {systemAlerts.length === 0 && (
              <div className="text-slate-600 italic text-center pt-8">
                {t.noEvents}
              </div>
            )}
            {systemAlerts.map((alert, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-indigo-500 font-bold">[WS SYSTEM]</span>
                <span className="text-slate-300">{alert}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Share / Invite Pop-up Modal (Requirement #2: QR Code & Deep Link) */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-3xl p-6 relative shadow-2xl animate-in fade-in zoom-in duration-200">

            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center"
            >
              &times;
            </button>

            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto">
                <QrCode className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{t.inviteTitle}</h3>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  {t.inviteDesc}
                </p>
              </div>

              {/* QR Code image render */}
              {qrCodeDataUrl ? (
                <div className="bg-white p-3.5 rounded-2xl inline-block shadow-inner mx-auto border-4 border-indigo-900/25">
                  <img src={qrCodeDataUrl} alt="Invitation QR Code" className="w-44 h-44 select-all" />
                </div>
              ) : (
                <div className="w-44 h-44 bg-slate-950 flex items-center justify-center text-xs text-slate-500 mx-auto rounded-2xl">
                  Generating QR...
                </div>
              )}

              <div className="space-y-1 text-center">
                <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest">
                  {t.deepLink}
                </span>

                <div className="flex gap-2 bg-slate-950 border border-slate-800 rounded-xl p-1.5 items-center">
                  <input
                    type="text"
                    readOnly
                    value={invitationLink}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="bg-transparent border-none text-xs text-slate-300 flex-1 px-2 select-all focus:outline-none focus:ring-0 truncate"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(invitationLink);
                      alert(t.copied);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition"
                  >
                    {t.copy}
                  </button>
                </div>
              </div>

              {/* Quick instructions */}
              <div className="text-[11px] text-slate-500 bg-slate-950 p-3 rounded-xl border border-slate-900 text-left space-y-1">
                <div className="font-bold text-slate-400">{t.howToJoin}</div>
                <div>{t.howToJoin1}</div>
                <div>{t.howToJoin2}</div>
                <div>{t.howToJoin3} <span className="text-indigo-400 font-bold">{groupId}</span>.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <footer className="border-t border-slate-900 bg-slate-950 p-6 text-center text-xs text-slate-500 mt-auto">
        <p>© 2026 SimuTrans Pro. 同声传译/组群翻译多设备同屏仿真调试沙盒系统.</p>
      </footer>
    </div>
  );
}
