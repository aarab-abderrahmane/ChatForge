export const SideBar = ({ isOpen, toggleSidebar, logs="" })=>{



    return(

        <div className={`
            fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out
            bg-black/90 border-r border-emerald-300/50 w-64 flex flex-col
            ${isOpen ? "translate-x-0" : "-translate-x-full" }
            md:relative md:translate-x-0 md:w-64 md:shrink-0
        `}>
            
            <div className="h-14 border-b border-green-400 flex items-center justify-between px-4">
                    
                    <h1 className="text-lg font-bold text-green-400 tracking-wider font-['Share_Tech_Mono']">
                        CHAT<span className="text-green-400">_FORGE</span>
                    </h1>

                    <button
                        className="md:hidden text-emerald-600 hover:text-emerald-300"
                        onClick={toggleSidebar}
                    >
                        [X]

                    </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* System Stats Mockup */}
        <section>
          <h3 className="text-xs font-bold text-emerald-800 mb-2 uppercase tracking-widest border-b border-emerald-900/30 pb-1">System Resources</h3>
          <div className="space-y-2 mt-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-emerald-600">
                <span>CPU_CORE_0</span>
                <span>34%</span>
              </div>
              <div className="h-1 bg-emerald-900/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500/50 w-[34%]"></div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-emerald-600">
                <span>MEMORY</span>
                <span>68%</span>
              </div>
              <div className="h-1 bg-emerald-900/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500/50 w-[68%]"></div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-emerald-600">
                <span>NEURAL_LINK</span>
                <span>99%</span>
              </div>
              <div className="h-1 bg-emerald-900/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500/50 w-[99%]"></div>
              </div>
            </div>
          </div>
        </section>

        {/* System Logs */}
        <section>
          <h3 className="text-xs font-bold text-emerald-800 mb-2 uppercase tracking-widest border-b border-emerald-900/30 pb-1">Activity Log</h3>
          <ul className="space-y-2 font-mono text-[10px] leading-tight opacity-80">
            {/* {logs.slice().reverse().map(log => (
              <li key={log.id} className="flex gap-2">
                <span className="text-emerald-700 min-w-[50px]">{log.timestamp.toLocaleTimeString([], {hour12: false})}</span>
                <span className={`${
                  log.type === 'error' ? 'text-red-500' : 
                  log.type === 'warn' ? 'text-amber-500' : 
                  log.type === 'success' ? 'text-emerald-400' : 'text-emerald-600'
                }`}>
                  {'>'} {log.message}
                </span>
              </li>
            ))} */}
          </ul>
        </section>
      </div>


        <div className="p-4 border-t border-emerald-900/50 text-[10px] text-emerald-800 text-center">
        V.2.0.4-ALPHA // UNREGISTERED
      </div>


        </div>



    )



}