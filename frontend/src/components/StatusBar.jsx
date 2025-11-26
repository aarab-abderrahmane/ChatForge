import { useEffect , useState } from "react";

export const StatusBar = ({ state }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-8 bg-emerald-950/30 border-t border-emerald-500/30 flex items-center px-4 text-xs font-mono select-none backdrop-blur-sm z-40 w-full shrink-0">
      <div className="flex-1 flex gap-6">
        <span className={`flex items-center gap-2 ${state.isConnected ? 'text-emerald-400' : 'text-red-500'}`}>
          <span className={`w-2 h-2 rounded-full ${state.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
          {state.isConnected ? 'ONLINE' : 'OFFLINE'}
        </span>
        
        <span className="text-emerald-700">
          LATENCY: <span className="text-emerald-400">{state.latency}ms</span>
        </span>
        
        <span className="text-emerald-700 hidden sm:inline">
          PROTOCOL: <span className="text-emerald-400">{state.activeProtocol}</span>
        </span>

        <span className="text-emerald-700 hidden sm:inline">
          SEC_LEVEL: <span className="text-emerald-400">{state.securityLevel}</span>
        </span>
      </div>

      <div className="text-emerald-600">
        {time.toISOString().split('T')[0]} <span className="text-emerald-400">{time.toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

