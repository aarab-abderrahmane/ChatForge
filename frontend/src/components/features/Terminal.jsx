"use client";;
import { cn } from "../../lib/utils";
import { motion } from "motion/react";
import { useEffect, useRef, useState ,useContext} from "react";


// code block 
import { Response } from "../ui/shadcn-io/ai/response";

//guidePage
import { GuidePage } from '../../pages/guidePage'

import {
  CheckIcon, CopyIcon ,
  RefreshCcwIcon,
  ShareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from 'lucide-react';


//context
import {chatsContext} from '../../context/chatsContext'



export const AnimatedSpan = ({
  children,
  delay = 0,
  className,
  ...props
}) => (
  <motion.div
    initial={{ opacity: 0, y: -5 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay: delay / 1000 }}
    className={cn("grid text-md  text-wrap font-normal tracking-tight", className)}
    {...props}>
    {children}
  </motion.div>
);

export const TypingAnimation = ({
  children,
  className,
  duration = 60,
  delay = 0,
  as: Component = "span",
  ...props
}) => {
  if (typeof children !== "string") {
    throw new Error("TypingAnimation: children must be a string. Received:");
  }

  const MotionComponent = motion.create(Component, {
    forwardMotionProps: true,
  });

  const [displayedText, setDisplayedText] = useState("");
  const [started, setStarted] = useState(false);
  const elementRef = useRef(null);

  useEffect(() => {
    const startTimeout = setTimeout(() => {
      setStarted(true);
    }, delay);
    return () => clearTimeout(startTimeout);
  }, [delay]);

  useEffect(() => {
    if (!started) return;

    let i = 0;
    const typingEffect = setInterval(() => {
      if (i < children.length) {
        setDisplayedText(children.substring(0, i + 1));
        i++;
      } else {
        clearInterval(typingEffect);
      }
    }, duration);

    return () => {
      clearInterval(typingEffect);
    };
  }, [children, duration, started]);

  return (
    <MotionComponent
      ref={elementRef}
      className={cn("text-md text-green-500 neon-text font-normal tracking-tight", className)}
      {...props}>
      {displayedText}
    </MotionComponent>
  );
};

export const Terminal = ({
  chats,
  copyToClipboard,
  handleSend,
  loading,
  isCopied,
  query,
  setQuery,
  messagesEndRef, 
  className,
  setShowCmdMenu,
  showCmdMenu
}) => {


  const COMMAND_PREFIX = "//>"

  const {preferences} = useContext(chatsContext)

  const lastMes = chats[chats.length-1]

  const Content = chats.flatMap((obj, index) => {
    if (obj.type === "ms") {
      return obj.content.map((ms, i) => (
        <AnimatedSpan key={`${index}-${i}`} delay={0}>{ms}</AnimatedSpan>
      ));
    } else {
      return [
        <div className="group">

        <AnimatedSpan key={`${index}-q`} className="neon-text my-4" delay={0}>{obj.question}</AnimatedSpan>
        <div >
        <Response key={`${index}-a`}  className={` ${obj.type==="error" ? "text-red-500" : ""}  `} >{obj.answer}</Response>

            {
              obj.answer && (
              isCopied.state && isCopied.idMes === obj.id ? 
                <div className="p-1.5">
                <CheckIcon className="size-4 " />

                </div>
              :
                <div className={`size-9 p-1.5 cursor-pointer ${lastMes.id === obj.id ? "" : "hidden group-hover:block"}`}   onClick={()=>copyToClipboard(obj.id)}>
                  <CopyIcon className="size-4 " />
                </div>

              )

            }
            

        </div>

        </div>

      ];
    }
  });
  



  const handlekeyDown = (e)=>{
        if(e.key === "Enter" && !e.shiftKey){
          
          setQuery('')
          handleSend(e)

        }
  }



  const handleInputChange = (e)=>{
    const val = e.target.value
    setQuery(val)
    if(val.startsWith(COMMAND_PREFIX)){
      setShowCmdMenu(true)
    }else{
      setShowCmdMenu(false)
    }

  }
  




  return (
    <div
      className={cn(
        "z-0 flex flex-col  custom-scroll rounded-xl border border-green-500 bg-background h-[85vh] md:max-h-[600px] xl:max-h-[800px] w-[95vw] md:w-[70vw] md:max-w-[1000px]  overflow-hidden  ",
        className
      )}>

      <div className="sticky drop-shadow-[0_50px_10px_rgba(0,0,0,0.8)]  w-full flex items-center gap-4 gap-y-2 border-b border-green-500 bg-[#111927] p-4">
        <div className="flex flex-row gap-x-2 ">
          <div className="h-2 w-2 md:w-3 md:h-3 rounded-full bg-red-500"></div>
          <div className="h-2 w-2 md:w-3 md:h-3 rounded-full bg-yellow-500"></div>
          <div className="h-2 w-2 md:w-3 md:h-3 rounded-full bg-green-500"></div>
        </div>
        <div className="text-white">
          {">_"}chatforge-terminal
        </div>
      </div>



      {

        preferences.currentPage==="chat"
        ? (

            <pre className="   h-full overflow-y-scroll  overflow-x-hidden">
              <code >
                <div className=" p-6 mt-6">
                  
                {Content}

                </div>
                
                <div className="flex gap-2 items-center sticky bottom-0 p-4 bg-gradient-to-t from-black/100 via-black/100 to-black/70">
                {!loading && (
                  <div className="relative w-full">
                    
                    {showCmdMenu && (


                        <div className="cmd-menu">
                        <div className="cmd-header">Available Commands</div>
                        
                          <div 
                            key={0} 
                            className="cmd-item"
                          >
                            <span className="cmd-text">ssqdz</span>
                            <span className="cmd-desc">hello mouad</span>
                          </div>
                      
                      </div>
                    )}


                  <div className="flex items-start w-full gap-2">
                  <span className="inline-block  h-full ">{">"}</span> <textarea   onKeyDown={handlekeyDown} autoFocus  value={query} onChange={handleInputChange}   className=" outline-none border-none w-full "></textarea>
                  </div>

                  </div>
                )}

                {loading&& <span className="loading inline-block ">/</span>}

                </div>

                <div ref={messagesEndRef} />

                </code>
                
            </pre>

        ):(

            <GuidePage/>

        )
      }




    </div>
  );
};