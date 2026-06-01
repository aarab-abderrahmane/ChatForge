'use client';
import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  forwardRef,
} from 'react';

const TypingText = forwardRef(function TypingText(
  {
    text,
    as: Component = 'div',
    typingSpeed = 50,
    initialDelay = 0,
    pauseDuration = 2000,
    deletingSpeed = 30,
    loop = true,
    className = '',
    showCursor = true,
    hideCursorWhileTyping = false,
    cursorCharacter = '|',
    cursorClassName = '',
    cursorBlinkDuration = 0.5,
    textColors = [],
    variableSpeed,
    onSentenceComplete,
    startOnVisible = false,
    reverseMode = false,
    ...props
  },
  forwardedRef
) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(!startOnVisible);

  const cursorRef = useRef(null);
  const containerRef = useRef(null);

  // Merge forwarded ref with local ref
  const setRef = useCallback(
    (node) => {
      containerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef]
  );

  const textArray = useMemo(
    () => (Array.isArray(text) ? text : [text]),
    [text]
  );

  const getRandomSpeed = useCallback(() => {
    if (!variableSpeed) return typingSpeed;
    const { min, max } = variableSpeed;
    return Math.random() * (max - min) + min;
  }, [variableSpeed, typingSpeed]);

  const currentTextColor = useMemo(() => {
    if (textColors.length === 0) return 'currentColor';
    return textColors[currentTextIndex % textColors.length];
  }, [textColors, currentTextIndex]);

  // ── Intersection Observer for lazy start ──
  useEffect(() => {
    if (!startOnVisible || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [startOnVisible]);

  // ── Cursor blink animation (CSS) ──
  useEffect(() => {
    if (!showCursor || !cursorRef.current) return;
    const el = cursorRef.current;
    el.style.animation = `typing-blink ${cursorBlinkDuration}s ease-in-out infinite alternate`;
    return () => {
      el.style.animation = '';
    };
  }, [showCursor, cursorBlinkDuration]);

  // ── Core typing/deleting loop ──
  useEffect(() => {
    if (!isVisible) return;

    let timeout;

    const currentText = textArray[currentTextIndex];
    const processedText = reverseMode
      ? currentText.split('').reverse().join('')
      : currentText;

    if (isDeleting) {
      if (displayedText === '') {
        setIsDeleting(false);

        if (currentTextIndex === textArray.length - 1 && !loop) return;

        onSentenceComplete?.(textArray[currentTextIndex], currentTextIndex);

        setCurrentTextIndex((prev) => (prev + 1) % textArray.length);
        setCurrentCharIndex(0);
        timeout = setTimeout(() => {}, pauseDuration);
      } else {
        timeout = setTimeout(() => {
          setDisplayedText((prev) => prev.slice(0, -1));
        }, deletingSpeed);
      }
    } else {
      if (currentCharIndex < processedText.length) {
        timeout = setTimeout(() => {
          setDisplayedText((prev) => prev + processedText[currentCharIndex]);
          setCurrentCharIndex((prev) => prev + 1);
        }, variableSpeed ? getRandomSpeed() : typingSpeed);
      } else if (textArray.length > 1) {
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, pauseDuration);
      }
    }

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentCharIndex,
    displayedText,
    isDeleting,
    isVisible,
    textArray,
    currentTextIndex,
    deletingSpeed,
    pauseDuration,
    typingSpeed,
    loop,
    initialDelay,
    reverseMode,
  ]);

  const shouldHideCursor =
    hideCursorWhileTyping &&
    (currentCharIndex < textArray[currentTextIndex]?.length || isDeleting);

  const isBarCursor = cursorCharacter === '|';

  return (
    <Component
      ref={setRef}
      className={`typing-text-container inline-block whitespace-pre-wrap tracking-tight ${className}`}
      {...props}
    >
      <span className="typing-text-content" style={{ color: currentTextColor }}>
        {displayedText}
      </span>

      {showCursor && (
        <span
          ref={cursorRef}
          className={`typing-cursor inline-block ${shouldHideCursor ? 'opacity-0' : 'opacity-100'} ${
            isBarCursor
              ? `typing-cursor-bar h-[1.1em] w-[2px] translate-y-[0.1em] bg-foreground ml-[1px] ${cursorClassName}`
              : `ml-1 ${cursorClassName}`
          }`}
        >
          {isBarCursor ? '' : cursorCharacter}
        </span>
      )}
    </Component>
  );
});

export default TypingText;
