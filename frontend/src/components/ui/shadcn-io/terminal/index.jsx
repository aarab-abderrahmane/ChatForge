"use client";;
import { cn } from "../../../../lib/utils";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

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
  handleSend,
  loading,
  query,
  setQuery,
  messagesEndRef, 
  className
}) => {


  const Content = chats.flatMap((obj, index) => {
    if (obj.type === "ms") {
      return obj.content.map((ms, i) => (
        <AnimatedSpan key={`${index}-${i}`} delay={0}>{ms}</AnimatedSpan>
      ));
    } else {
      return [
        <AnimatedSpan key={`${index}-q`} className="neon-text" delay={0}>{obj.question}</AnimatedSpan>,
        <AnimatedSpan key={`${index}-a`} delay={0}>{obj.answer}</AnimatedSpan>
      ];
    }
  });
  



  const handlekeyDown = (e)=>{
        if(e.key === "Enter" && !e.shiftKey){
          
          setQuery('')
          handleSend(e)
          console.log("send")

        }
  }




  return (
    <div
      className={cn(
        "z-0 flex flex-col  custom-scroll rounded-xl border border-green-500 bg-background h-[90vh] md:max-h-[500px] xl:max-h-[800px] w-[95vw] md:max-w-[800px]  overflow-hidden  ",
        className
      )}>

      <div className="sticky  w-full flex flex-col gap-y-2 border-b border-green-500 bg-[#111927] p-4">
        <div className="flex flex-row gap-x-2 ">
          <div className="h-2 w-2 md:w-3 md:h-3 rounded-full bg-red-500"></div>
          <div className="h-2 w-2 md:w-3 md:h-3 rounded-full bg-yellow-500"></div>
          <div className="h-2 w-2 md:w-3 md:h-3 rounded-full bg-green-500"></div>
        </div>
      </div>


      <pre className="p-4   h-full overflow-y-scroll">
        <code className="grid gap-y-1   p-2 ">
          {Content}
          <div className="flex gap-2 items-center">
          {!loading && (
            <>
            <span className="inline-block  h-full">{">"}</span> <textarea rows={3}  onKeyDown={handlekeyDown} autoFocus  value={query} onChange={(e)=>setQuery(e.target.value)}   className=" outline-none border-none w-full"></textarea>
            </>
          )}

          {loading&& <span className="loading inline-block ">/</span>}

          </div>

          <div ref={messagesEndRef} />

          </code>
          
      </pre>


    </div>
  );
};