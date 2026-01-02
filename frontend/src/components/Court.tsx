import React, { useRef, useEffect, useState } from 'react';

interface CourtProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const Court: React.FC<CourtProps> = ({ children, className = '', style }) => {
  // SVG原始宽高比：500/470 ≈ 1.064
  const svgAspectRatio = 500 / 470;
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgPosition, setImgPosition] = useState<{ left: string; top: string; width: string; height: string } | null>(null);
  
  const updateImgPosition = () => {
    if (containerRef.current && imgRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const imgRect = imgRef.current.getBoundingClientRect();
      
      // 计算图片在容器中的相对位置（百分比）
      const left = ((imgRect.left - containerRect.left) / containerRect.width) * 100;
      const top = ((imgRect.top - containerRect.top) / containerRect.height) * 100;
      const width = (imgRect.width / containerRect.width) * 100;
      const height = (imgRect.height / containerRect.height) * 100;
      
      setImgPosition({
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
      });
    }
  };
  
  useEffect(() => {
    updateImgPosition();
    window.addEventListener('resize', updateImgPosition);
    
    // 使用 ResizeObserver 监听容器尺寸变化
    const resizeObserver = new ResizeObserver(updateImgPosition);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateImgPosition);
      resizeObserver.disconnect();
    };
  }, []);
  
  return (
    <div 
      ref={containerRef}
      className={`relative bg-court-bg rounded-lg overflow-hidden ${className}`} 
      style={style}
    >
      <img
        ref={imgRef}
        src="/assets/images/court/half-court.svg"
        alt="Basketball Court"
        className="w-full h-full object-contain opacity-30"
        style={{ aspectRatio: `${svgAspectRatio}` }}
        onLoad={updateImgPosition}
      />
      {/* 创建一个覆盖图片实际显示区域的定位层，用于显示投篮位置 */}
      {imgPosition && (
        <div 
          className="absolute"
          style={{
            left: imgPosition.left,
            top: imgPosition.top,
            width: imgPosition.width,
            height: imgPosition.height,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

export default Court;

