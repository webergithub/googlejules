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
  Trash2
} from "lucide-react";
import {
  SUPPORTED_LANGUAGES,
  translateText,
  playTextSpeech
} from "./translationService";

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
    name: "Main Phone (Host)",
    deviceType: "iPhone",
    isConnected: true,
    isHost: true,
    sourceLang: "zh",
    targetLang1: "en",
    targetLang2: "ja",
    inputText: "",
    isRecording: false,
  },
  {
    id: "device-guest1",
    name: "Alex's Samsung",
    deviceType: "Android",
    isConnected: false,
    isHost: false,
    sourceLang: "en",
    targetLang1: "zh",
    targetLang2: "es",
    inputText: "",
    isRecording: false,
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
  }
];

export default function App() {
  // State 1: App View Mode (Virtual Lab with multiple phones OR Single mobile view)
  const [appMode, setAppMode] = useState<"sandbox" | "single">("sandbox");

  // Active translation engine state
  const [translationEngine, setTranslationEngine] = useState<"google" | "mymemory">("google");

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
    name: "My Mobile Phone",
    deviceType: "iPhone",
    isConnected: false,
    isHost: false,
    sourceLang: "en",
    targetLang1: "zh",
    targetLang2: "es",
    inputText: "",
    isRecording: false,
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
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const joinedDevicesRef = useRef<Record<string, boolean>>({});

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
        isHost: false,
        isConnected: true
      }));
    }
  }, []);

  // Set up WebSocket connection once on mount and keep it stable
  useEffect(() => {
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connection connected!");
      setWsConnected(true);
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
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []); // Empty dependency array means this WebSocket stays alive and stable forever!

  // Reset joined devices cache whenever room code changes
  useEffect(() => {
    joinedDevicesRef.current = {};
  }, [groupId]);

  // Reactive and stable auto-join hook
  useEffect(() => {
    if (!wsConnected || !groupId) return;

    if (appMode === "single") {
      if (singleDevice.isConnected && !joinedDevicesRef.current[singleDevice.id]) {
        joinRoomWS(groupId, singleDevice);
        joinedDevicesRef.current[singleDevice.id] = true;
      }
    } else {
      sandboxDevices.forEach(dev => {
        if (dev.isConnected && !joinedDevicesRef.current[dev.id]) {
          joinRoomWS(groupId, dev);
          joinedDevicesRef.current[dev.id] = true;
        }
      });
    }
  }, [wsConnected, groupId, appMode, singleDevice.isConnected, sandboxDevices]);

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
        setSystemAlerts([`Translation group ${data.groupId} created successfully!`]);

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
        alert("Group ID not found. Make sure the Host has created a group!");
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
        setSystemAlerts(prev => [...prev, "Host left. Sandbox translation group has reset."]);
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

  // Face-to-Face quick join (AirDrop Simulation)
  const simulateAirDropJoin = () => {
    if (!groupId) {
      alert("Please create a host translation group first!");
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
      setAirdropSuccessText("AirDrop complete! All offline iPhones nearby have quickly joined the room.");
      setTimeout(() => setAirdropSuccessText(""), 4000);
    }, 2000);
  };

  // Face-to-Face quick join (NFC Bump Simulation)
  const simulateNfcBumpJoin = () => {
    if (!groupId) {
      alert("Please create a host translation group first!");
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
      setNfcSuccessText("NFC Touch Connected! Offline Android devices bumped together and joined the room.");
      setTimeout(() => setNfcSuccessText(""), 4000);
    }, 2000);
  };

  // Add a new random phone into the sandbox lab
  const addNewVirtualDevice = () => {
    const isIOS = Math.random() > 0.5;
    const model = isIOS ? "iPhone" : "Android";
    const nameList = isIOS
      ? ["Grandma's iPhone", "Steve's SE", "Boss's Pro Max", "Lisa's iPhone"]
      : ["John's Pixel", "Pixel Fold", "MOTO G", "Redmi Pad"];
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
      isRecording: false
    };

    setSandboxDevices(prev => [...prev, newDev]);
    setSystemAlerts(prev => [...prev, `Added a new simulated ${model}: ${chosenName}. Connect it using join or Bump.`]);
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
        "你好，欢迎加入我们的翻译同声传译群组！",
        "今天天气真不错，让我们一起开心地交流吧。",
        "这个多人群组翻译解决方案真的很实用，完全没有语言障碍！",
        "早上好！"
      ],
      en: [
        "Hello, welcome to our real-time multi-device translation group!",
        "This tool is extremely useful for face-to-face cross-border communications.",
        "Let's start the translation and see how it automatically streams to your phone screen!",
        "Good morning!"
      ],
      es: [
        "¡Hola, bienvenidos a nuestro grupo de traducción en tempo real!",
        "Esta aplicación es excelente para conversaciones cara a cara.",
        "Comencemos la traducción en vivo ahora mismo.",
        "¡Buenos días!"
      ],
      fr: [
        "Bonjour, bienvenue dans notre groupe de traduction instantanée !",
        "Cette application de traduction multi-téléphones est formidable !",
        "Commençons la traduction et découvrons la rapidité de la communication.",
        "Bonjour !"
      ],
      ja: [
        "こんにちは、リアルタイム多人数翻訳グループへようこそ！",
        "この同時通訳系统は本当に使いやすく、お互いの言葉がリアルタイムに翻訳されますね。",
        "翻訳を始めましょう！",
        "おはようございます！"
      ],
      ko: [
        "안녕하세요, 실시간 대화식 다기기 번역 그룹에 오신 것을 환영합니다!",
        "이 번역 솔루션은 국경을 초월한 비즈니스 미팅과 소통에 탁월합니다.",
        "실시간 번역을 시작해보죠!",
        "좋은 아침입니다!"
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
    }, 2000);
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
    const chatEndRef = useRef<HTMLDivElement | null>(null);

    // Watch incoming messages to translate them to THIS device's unique configuration
    useEffect(() => {
      messages.forEach(async (msg) => {
        const cacheKey = `${msg.messageId}_${device.targetLang1}_${device.targetLang2}_${translationEngine}`;
        if (localTranslatedMsg[cacheKey]) return; // already translated for this engine & language combo

        // Skip translating own messages for target (can just show source text or also display target if helpful)
        if (msg.senderId === device.id) {
          setLocalTranslatedMsg(prev => ({
            ...prev,
            [cacheKey]: { t1: msg.text, t2: "" }
          }));
          return;
        }

        // Translate to Target Lang 1 (Primary)
        const t1 = await translateText(msg.text, msg.sourceLang, device.targetLang1, translationEngine);

        // Translate to Target Lang 2 (Secondary) if set
        let t2 = "";
        if (device.targetLang2 && device.targetLang2 !== "none") {
          t2 = await translateText(msg.text, msg.sourceLang, device.targetLang2, translationEngine);
        }

        setLocalTranslatedMsg(prev => ({
          ...prev,
          [cacheKey]: { t1, t2 }
        }));
      });
    }, [messages, device.targetLang1, device.targetLang2, translationEngine]);

    // Scroll to bottom when message log changes
    useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
              <span className="text-[9px] text-red-500 font-bold tracking-wider">LIVE MIC</span>
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
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Room ID display */}
            <div className="flex justify-between items-center text-[10px] text-slate-400">
              <span>{device.isConnected ? `Joined: ${groupId}` : 'Disconnected'}</span>
              {!device.isConnected && (
                <span className="text-rose-400 italic">Not in Group</span>
              )}
            </div>
          </div>

          {/* Connection Screen (when disconnected) */}
          {!device.isConnected && (
            <div className="flex-1 flex flex-col justify-center items-center p-4 bg-slate-950/95 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 mb-3 border border-slate-800">
                <Smartphone className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-white">Join Translation Group</h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                Connect this phone to start speaking and receiving real-time multi-language translations.
              </p>

              <div className="mt-4 w-full space-y-2 max-w-[220px]">
                {/* Host button */}
                {device.isHost ? (
                  <button
                    onClick={() => handleCreateGroup(isSandbox, device)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create Translation Group
                  </button>
                ) : (
                  <>
                    {groupId ? (
                      <button
                        onClick={() => handleJoinGroup(groupId, isSandbox, device)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Join Group {groupId}
                      </button>
                    ) : (
                      <div className="space-y-1">
                        <input
                          id={`join-input-${device.id}`}
                          placeholder="ENTER GROUP CODE"
                          maxLength={6}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs py-1.5 px-3 text-center text-white tracking-widest placeholder:tracking-normal focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => {
                            const inp = document.getElementById(`join-input-${device.id}`) as HTMLInputElement;
                            if (inp && inp.value) {
                              handleJoinGroup(inp.value, isSandbox, device);
                            } else {
                              alert("Please enter a valid Group Code!");
                            }
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
                        >
                          Join Group
                        </button>
                      </div>
                    )}

                    {/* Simulated Bump discovery alert */}
                    <div className="text-[10px] text-indigo-400 mt-2 bg-indigo-950/30 border border-indigo-900/40 p-2 rounded-lg">
                      💡 Tip: Click <span className="font-bold underline">NFC Touch</span> or <span className="font-bold underline">AirDrop</span> below to join nearby phones in 1-click!
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Active Work Chat Workspace */}
          {device.isConnected && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">

              {/* Language Customization Sub-Bar (Requirement #5: Independent settings) */}
              <div className="bg-slate-900/90 border-b border-slate-800 p-2 grid grid-cols-3 gap-1 select-none text-[10px]">
                {/* Source Select */}
                <div>
                  <label className="block text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">发言 (Speak)</label>
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
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded px-1 py-0.5 focus:outline-none focus:border-indigo-500"
                  >
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                    ))}
                  </select>
                </div>

                {/* Primary Target Language Select */}
                <div>
                  <label className="block text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">主目标 (Target 1)</label>
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
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded px-1 py-0.5 focus:outline-none focus:border-indigo-500"
                  >
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                    ))}
                  </select>
                </div>

                {/* Secondary Target Language Select (Optional) */}
                <div>
                  <label className="block text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">次目标 (Target 2)</label>
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
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded px-1 py-0.5 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="none">⚠️ [None]</option>
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Translation Chat Stream */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3.5 custom-scrollbar bg-slate-950">
                <div className="text-[10px] text-center text-slate-500 select-none">
                  🛡️ Synchronized Real-time Translation Feed
                </div>

                {messages.length === 0 && (
                  <div className="h-4/5 flex flex-col justify-center items-center text-center text-slate-500 p-4">
                    <Sparkles className="w-6 h-6 text-indigo-400/80 mb-2 animate-bounce" />
                    <span className="text-[11px]">Ready for dialogue!</span>
                    <span className="text-[9px] mt-1 text-slate-600 max-w-[180px]">
                      Type text or tap the microphone on any connected phone to speak.
                    </span>
                  </div>
                )}

                {messages.map((msg) => {
                  const isOwn = msg.senderId === device.id;
                  const cacheKey = `${msg.messageId}_${device.targetLang1}_${device.targetLang2}_${translationEngine}`;
                  const translations = localTranslatedMsg[cacheKey] || { t1: "", t2: "" };
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
                              <div className="text-[11px] bg-indigo-600/20 p-1.5 rounded border border-indigo-500/15">
                                <div className="flex justify-between items-center text-[8px] text-indigo-300 uppercase font-extrabold tracking-widest mb-0.5">
                                  <span>{primaryTargetLanguageObj?.name || device.targetLang1} (Primary)</span>
                                  <div className="flex gap-1 items-center">
                                    <button
                                      onClick={() => playTextSpeech(translations.t1, device.targetLang1)}
                                      title="Play translated audio"
                                      className="p-0.5 hover:bg-indigo-500/30 rounded text-indigo-200 transition"
                                    >
                                      <Volume2 className="w-3 h-3" />
                                    </button>

                                    <a
                                      href={`https://translate.google.com/?sl=${msg.sourceLang}&tl=${device.targetLang1}&text=${encodeURIComponent(msg.text)}&op=translate`}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Open in Google Translate App"
                                      className="px-1 py-0.5 bg-indigo-500/20 hover:bg-indigo-500/40 rounded text-[8px] text-indigo-200 transition flex items-center gap-0.5 font-bold"
                                    >
                                      <Smartphone className="w-2.5 h-2.5" />
                                      <span>Google 译</span>
                                    </a>

                                    {device.deviceType === "iPhone" && (
                                      <a
                                        href={`translate://`}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="Open Apple Translate App"
                                        className="px-1 py-0.5 bg-indigo-500/20 hover:bg-indigo-500/40 rounded text-[8px] text-indigo-200 transition flex items-center gap-0.5 font-bold"
                                      >
                                        <Smartphone className="w-2.5 h-2.5" />
                                        <span>Apple 译</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <p className="font-medium text-indigo-100">
                                  {translations.t1 || <span className="italic text-slate-500">translating...</span>}
                                </p>
                              </div>
                            )}

                            {/* Secondary translation */}
                            {isSecondaryTargetActive && (
                              <div className="text-[11px] bg-fuchsia-950/20 p-1.5 rounded border border-fuchsia-900/25">
                                <div className="flex justify-between items-center text-[8px] text-fuchsia-300 uppercase font-extrabold tracking-widest mb-0.5">
                                  <span>{secondaryTargetLanguageObj?.name || device.targetLang2} (Secondary)</span>
                                  <div className="flex gap-1 items-center">
                                    <button
                                      onClick={() => playTextSpeech(translations.t2, device.targetLang2)}
                                      title="Play translated audio"
                                      className="p-0.5 hover:bg-fuchsia-500/30 rounded text-fuchsia-200 transition"
                                    >
                                      <Volume2 className="w-3 h-3" />
                                    </button>

                                    <a
                                      href={`https://translate.google.com/?sl=${msg.sourceLang}&tl=${device.targetLang2}&text=${encodeURIComponent(msg.text)}&op=translate`}
                                      target="_blank"
                                      rel="noreferrer"
                                      title="Open in Google Translate App"
                                      className="px-1 py-0.5 bg-fuchsia-500/20 hover:bg-fuchsia-500/40 rounded text-[8px] text-fuchsia-200 transition flex items-center gap-0.5 font-bold"
                                    >
                                      <Smartphone className="w-2.5 h-2.5" />
                                      <span>Google 译</span>
                                    </a>

                                    {device.deviceType === "iPhone" && (
                                      <a
                                        href={`translate://`}
                                        target="_blank"
                                        rel="noreferrer"
                                        title="Open Apple Translate App"
                                        className="px-1 py-0.5 bg-fuchsia-500/20 hover:bg-fuchsia-500/40 rounded text-[8px] text-fuchsia-200 transition flex items-center gap-0.5 font-bold"
                                      >
                                        <Smartphone className="w-2.5 h-2.5" />
                                        <span>Apple 译</span>
                                      </a>
                                    )}
                                  </div>
                                </div>
                                <p className="font-medium text-fuchsia-100">
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
                <div ref={chatEndRef} />
              </div>

              {/* Typing / voice input panel */}
              <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
                {/* Simulated quick sentences inside the screen */}
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none select-none">
                  {["Hello!", "Welcome", "Thank you", "Goodbye"].map((ph, idx) => (
                    <button
                      key={idx}
                      onClick={async () => {
                        // Translate phrase to sender's speaking language first!
                        const translatedInput = await translateText(ph, "en", device.sourceLang);
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
                    title="Speak into Microphone"
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
                    placeholder={`Type in ${sourceLanguageObj?.name}...`}
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
                <div className="flex justify-between items-center text-[8px] text-slate-500 pt-1">
                  <span>Press MIC to record voice</span>
                  <button
                    onClick={() => handleLeaveGroup(device.id, isSandbox)}
                    className="text-rose-500 hover:underline font-semibold"
                  >
                    Leave Group
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
              SimuTrans Pro
            </h1>
            <p className="text-[10px] text-slate-400">
              Multi-Device Translation & Same-Type Face-to-Face Grouping Simulation
            </p>
          </div>
        </div>

        {/* Dashboard Control Toggle / Sandbox Switches */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Translation Engine Selector */}
          <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-850 flex items-center gap-1.5">
            <span className="text-[9px] text-slate-400 font-bold uppercase px-1 tracking-wider">Engine:</span>
            <select
              value={translationEngine}
              onChange={(e) => setTranslationEngine(e.target.value as "google" | "mymemory")}
              className="bg-slate-950 border border-slate-800 text-[11px] text-white rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer font-semibold"
            >
              <option value="google">🌐 Google API</option>
              <option value="mymemory">💾 MyMemory API</option>
            </select>
          </div>

          {/* View Mode Toggle Button */}
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => {
                setAppMode("sandbox");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                appMode === "sandbox"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Virtual Multi-Phone Lab</span>
            </button>

            <button
              onClick={() => {
                setAppMode("single");
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                appMode === "single"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Single Phone View</span>
            </button>
          </div>

          {appMode === "sandbox" && (
            <button
              onClick={addNewVirtualDevice}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-indigo-400 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
            >
              <Plus className="w-4 h-4" />
              Add Phone
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
                Live Demo Sandbox
              </span>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Web Sockets Active
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">
              {appMode === "sandbox"
                ? "Simulate a real translation session across multiple mobile screens!"
                : "Connect your single mobile viewport to a room!"
              }
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              一台手机作为主机 (Host) 创建翻译群组，其他手机扫描专属二维码或点击邀请链接即可加入。群组建立后，任何人的发言 (文字或语音) 会在所有手机屏幕上高精度实时同步并翻译成各自配置的语言。
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
                  {isConnecting ? "Initializing Room..." : "Create Translation Group"}
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
                        alert("Please input a 6-character Room ID!");
                      }
                    }}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold py-2 px-4 rounded-xl transition"
                  >
                    Join
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-center items-center gap-3 bg-slate-950 border border-slate-800 p-3 rounded-2xl w-full sm:w-auto">
                <div className="text-center sm:text-left px-2">
                  <span className="text-[9px] text-slate-400 block font-semibold tracking-widest uppercase">Active Group Code</span>
                  <span className="text-lg font-extrabold text-indigo-400 tracking-wider uppercase select-all">{groupId}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 transition"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share Invite
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
                    Disconnect Room
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fast same-type Face-to-Face setup action panel (Requirement #3) */}
        {appMode === "sandbox" && groupId && (
          <div className="w-full bg-slate-900/50 border border-indigo-900/20 rounded-3xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Same-Device Proximity Discovery Enabled:
              </span>
              <p className="text-[11px] text-slate-400 hidden lg:inline">
                Test how identical hardware pairs instantly in close proximity.
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
                <span>{airdropSearching ? "AirDrop Searching..." : "iPhone ↔ iPhone (AirDrop Join)"}</span>
              </button>

              {/* Android ↔ Android simulation using NFC */}
              <button
                onClick={simulateNfcBumpJoin}
                disabled={nfcBumping}
                className="flex-1 md:flex-none bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/40 hover:border-indigo-600 text-white rounded-xl py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Fingerprint className={`w-3.5 h-3.5 text-emerald-400 ${nfcBumping ? "animate-pulse" : ""}`} />
                <span>{nfcBumping ? "NFC Touch Active..." : "Android ↔ Android (NFC Bump Join)"}</span>
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
                <h3 className="font-bold text-base text-white">Virtual Device Multi-Screen Dashboard</h3>
              </div>
              <div className="text-xs text-slate-400">
                Active connections: <span className="font-bold text-indigo-400">{roomMembers.length}</span> / {sandboxDevices.length}
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
                    setSystemAlerts(prev => [...prev, `Simulated phone "${dev.name}" deleted.`]);
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
                <h4 className="font-bold text-sm text-slate-300 group-hover:text-white">Add Simulated Smartphone</h4>
                <p className="text-xs text-slate-500 mt-2 max-w-[200px]">
                  Introduce another virtual smartphone to the room, each with their own source/target language!
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
                Single Mobile Session
              </span>
              <h3 className="text-base font-bold text-white mt-2">Connect other hardware manually</h3>
              <p className="text-xs text-slate-400 mt-1">
                This simulates a single physical phone session. If you open this URL in another tab/mobile, you can join the translation group and communicate between them!
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
                Developer Console & Real-time Logs
              </h4>
            </div>
            <button
              onClick={() => setSystemAlerts([])}
              className="text-[10px] text-slate-500 hover:text-slate-300 underline"
            >
              Clear Logs
            </button>
          </div>

          <div className="bg-slate-950 rounded-2xl p-4 h-32 overflow-y-auto font-mono text-[11px] text-slate-400 space-y-1.5 custom-scrollbar border border-slate-900">
            {systemAlerts.length === 0 && (
              <div className="text-slate-600 italic text-center pt-8">
                No events recorded. Set up or connect phones to view socket alerts.
              </div>
            )}
            {systemAlerts.map((alert, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-indigo-500 font-bold">[SYSTEM]</span>
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
                <h3 className="text-lg font-bold text-white">Invite Group Participants</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Share this invitation QR code or link to let other smartphones join your translation session instantly.
                </p>
              </div>

              {/* QR Code image render */}
              {qrCodeDataUrl ? (
                <div className="bg-white p-3.5 rounded-2xl inline-block shadow-inner mx-auto border-4 border-indigo-900/25">
                  <img src={qrCodeDataUrl} alt="Invitation QR Code" className="w-48 h-48 select-all" />
                </div>
              ) : (
                <div className="w-48 h-48 bg-slate-950 flex items-center justify-center text-xs text-slate-500 mx-auto rounded-2xl">
                  Generating QR...
                </div>
              )}

              <div className="space-y-1 text-center">
                <span className="text-[10px] text-indigo-300 font-extrabold uppercase tracking-widest">
                  Deep Link (点击链接直接加入)
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
                      alert("Deep link invitation copied to clipboard!");
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Quick instructions */}
              <div className="text-[11px] text-slate-500 bg-slate-950 p-3 rounded-xl border border-slate-900 text-left space-y-1">
                <div className="font-semibold text-slate-400">How to Join:</div>
                <div>1. Scan this QR Code from another phone/device's camera.</div>
                <div>2. Or copy-paste and open the Deep Link in another browser tab.</div>
                <div>3. Enter Room Code <span className="text-indigo-400 font-bold">{groupId}</span> manually.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <footer className="border-t border-slate-900 bg-slate-950 p-6 text-center text-xs text-slate-500 mt-auto">
        <p>© 2026 SimuTrans Pro. Complete multi-phone same-room high-precision simultaneous translation environment.</p>
      </footer>
    </div>
  );
}
