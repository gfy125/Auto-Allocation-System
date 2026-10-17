import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const useDynamicFavicon = () => {
  const location = useLocation();

  useEffect(() => {
    const updateFavicon = () => {
      const pathname = location.pathname;
      
      // check route path
      if (pathname.startsWith('/student_modern')) {
        // use logo_uni_tran.png for routes starting with /student_modern
        setFavicon('/logo_uni_tran.png');
      } else {
        // use logo_uni.png for all other routes
        setFavicon('/logo_uni.png');
      }
    };

    const setFavicon = (iconPath: string) => {
      // clear all existing favicon links
      const existingLinks = document.querySelectorAll("link[rel*='icon']");
      existingLinks.forEach(link => link.remove());
      
      // create new favicon link
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      
      // add timestamp to prevent cache
      const timestamp = Date.now();
      const iconPathWithTimestamp = `${iconPath}?t=${timestamp}`;
      link.href = iconPathWithTimestamp;
      
      // add to head
      document.head.appendChild(link);
      
      console.log(`🎨 Favicon updated to: ${iconPath} (with cache busting)`);
      
      // debug information
      console.log(`🔍 Current favicon link:`, link);
      console.log(`🔍 Favicon href:`, link.href);
      
      // try force refresh - by changing rel attribute
      setTimeout(() => {
        link.rel = 'shortcut icon';
        setTimeout(() => {
          link.rel = 'icon';
        }, 100);
      }, 100);
      
      // extra force refresh - create multiple favicon links
      const additionalLink = document.createElement('link');
      additionalLink.rel = 'icon';
      additionalLink.type = 'image/png';
      additionalLink.href = `${iconPath}?t=${timestamp + 1}`;
      document.head.appendChild(additionalLink);
      
      // create different sized favicon links
      const sizes = ['16x16', '32x32', '48x48'];
      sizes.forEach(size => {
        const sizeLink = document.createElement('link');
        sizeLink.rel = 'icon';
        sizeLink.type = 'image/png';
        sizeLink.sizes = size;
        sizeLink.href = `${iconPath}?t=${timestamp + Math.random()}`;
        document.head.appendChild(sizeLink);
      });
      
      // force page re-render
      document.title = document.title;
      
      // try force refresh - by changing body attribute
      const body = document.body;
      if (body) {
        body.setAttribute('data-favicon-updated', timestamp.toString());
      }
      
      // last resort: notify user to manually refresh
      console.log(`💡 If favicon doesn't update, try: Ctrl+F5 (hard refresh)`);
    };

    updateFavicon();
  }, [location.pathname]);
};
