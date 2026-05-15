import React, { useEffect, useState } from 'react';
import LifeTrackerDesktop from './LifeTrackerDesktop';
import LifeTrackerMobile from './LifeTrackerMobile';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(max-width: 640px)')?.matches ?? false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia('(max-width: 640px)');
    const onChange = (e) => setIsMobile(e.matches);
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    setIsMobile(mql.matches);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return isMobile;
};

const LifeTracker = () => {
  const isMobile = useIsMobile();
  return isMobile ? <LifeTrackerMobile /> : <LifeTrackerDesktop />;
};

export default LifeTracker;

