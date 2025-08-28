/*
 * גישה אולטימטיבית לתיקון בעיות תצוגה ב-WebRTC.
 * הקוד הזה משתמש בטכניקות קיצוניות שעובדות במקרים קשים שבהם שיטות סטנדרטיות נכשלות.
 */

// מעקב אם כבר הפעלנו את הפיקס
let nuclearFixApplied = false;

// פונקציה לאכיפת תצוגת אלמנט וידאו
export function applyNuclearFix() {
  if (nuclearFixApplied) return;
  
  console.log('💣 מפעיל תיקון קיצוני לבעיות תצוגת WebRTC');
  
  // הזרקת CSS שמאלץ את כל אלמנטי הווידאו להיות גלויים
  const style = document.createElement('style');
  style.textContent = `
    /* גלובלי - כל אלמנטי הווידאו */
    video {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      transform: translateZ(0) !important;
      will-change: transform !important;
      min-height: 100px !important;
      background-color: black !important;
      box-sizing: border-box !important;
      z-index: 100 !important;
    }
    
    /* תצוגת שדר - לשמור על יחס רוחב-גובה */
    div[class*="aspect-[16/9]"] video {
      object-fit: contain !important;
      width: 100% !important;
      height: 100% !important;
    }
    
    /* תצוגת צופה - למלא את כל המסך בווידאו כמו בטיקטוק */
    div[class*="aspect-[9/16]"] video {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      object-position: center !important;
      transform: translateZ(0) scale(1.5) !important; /* הגדלה אגרסיבית להבטחת כיסוי מלא כמו בטיקטוק */
      will-change: transform !important;
      margin: 0 !important;
      padding: 0 !important;
      z-index: 100 !important;
    }
    
    /* כפיית מאפייני מכל */
    div[class*="aspect-[9/16]"] {
      position: relative !important;
      overflow: hidden !important;
      display: block !important;
      width: 100% !important;
      background-color: black !important;
    }
    
    /* וידוא שמכלי הורים לא מסתירים את הווידאו */
    .video-container, [class*="video-container"], [class*="video"] {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      background-color: black !important;
      overflow: hidden !important;
    }
    
    /* קלאס מיוחד להחלפת וידאו גרסה קיצונית - כמו בטיקטוק */
    .nuclear-video {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
      object-position: center !important;
      transform: translateZ(0) scale(1.5) !important; /* הגדלה אגרסיבית להתאמה לתצוגת טיקטוק */
      will-change: transform !important;
      z-index: 1000 !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      background-color: black !important;
    }
    
    /* וידוא מקסימלי של נראות */
    .force-visible {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      z-index: 999 !important;
    }
  `;
  document.head.appendChild(style);
  
  // שכתוב של פונקציית play כדי להבטיח שהניגון עובד
  const originalPlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function() {
    // כפיית סגנונות לפני הפעלה
    this.style.display = 'block';
    this.style.visibility = 'visible';
    this.style.opacity = '1';
    this.style.zIndex = '100';
    
    return originalPlay.call(this).catch(err => {
      console.warn('נתפסה שגיאת ניגון על ידי התיקון הקיצוני:', err);
      
      // אם הניגון נכשל, ננסה שוב עם אינטראקציית משתמש
      const resumePlay = () => {
        originalPlay.call(this).catch(() => {});
        document.removeEventListener('click', resumePlay);
        document.removeEventListener('touchstart', resumePlay);
      };
      
      document.addEventListener('click', resumePlay, { once: true });
      document.addEventListener('touchstart', resumePlay, { once: true });
      
      return Promise.resolve(); // לא להעביר את השגיאה הלאה
    });
  };
  
  // תיקון בעיות תצוגה ב-WebRTC - המתנה לטעינת העמוד
  window.addEventListener('load', () => {
    // חיפוש כל אלמנטי הווידאו ווידוא שהם מעוצבים כראוי
    setInterval(() => {
      document.querySelectorAll('video').forEach(v => {
        // בדיקה אם יש סטרים אבל אין מימדים (סימן לבעיית תצוגה)
        if (v.srcObject && v.videoWidth === 0 && v.videoHeight === 0) {
          console.log('🔄 תיקון קיצוני: זוהה אלמנט וידאו עם סטרים אבל ללא מימדים');
          
          // כפיית סגנונות
          v.style.display = 'block';
          v.style.visibility = 'visible';
          v.style.opacity = '1';
          v.style.backgroundColor = 'black';
          
          // בדיקת סוג המכל ושינוי object-fit בהתאם
          const parent = v.parentElement;
          if (parent) {
            if (parent.className.includes('aspect-[9/16]') || 
                (parent.parentElement && parent.parentElement.className.includes('aspect-[9/16]'))) {
              // עבור צופה - מילוי מלא
              v.style.objectFit = 'cover';
              v.style.transform = 'translateZ(0) scale(1.2)';
            } else if (parent.className.includes('aspect-[16/9]') || 
                      (parent.parentElement && parent.parentElement.className.includes('aspect-[16/9]'))) {
              // עבור שדר - הכלה
              v.style.objectFit = 'contain';
            }
          }
          
          // ניסיון לרענן את ה-srcObject
          const stream = v.srcObject;
          v.srcObject = null;
          setTimeout(() => {
            v.srcObject = stream;
            v.play().catch(() => {});
          }, 100);
        }
      });
    }, 3000);
    
    // סיעור קיצוני - החלפת כל אלמנטי הווידאו לאחר 5 שניות
    setTimeout(() => {
      console.log('🧨 מפעיל החלפה קיצונית של כל אלמנטי הווידאו');
      document.querySelectorAll('video').forEach(v => {
        if (v.srcObject) {
          replaceVideoElement(v);
        }
      });
    }, 5000);
  });
  
  nuclearFixApplied = true;
}

/**
 * החלפת אלמנט וידאו בעייתי באלמנט חדש
 * גישה קיצונית למצבים שבהם אלמנט וידאו לא מתפקד כראוי
 */
export function replaceVideoElement(oldVideo: HTMLVideoElement): HTMLVideoElement {
  console.log('[תיקון קיצוני] מחליף אלמנט וידאו לחלוטין:', oldVideo);
  
  // שמירת כל המאפיינים שצריך להעביר
  const parentNode = oldVideo.parentNode;
  const srcObject = oldVideo.srcObject;
  const muted = oldVideo.muted;
  const controls = oldVideo.controls;
  const playsInline = oldVideo.playsInline;
  const loop = oldVideo.loop;
  const className = oldVideo.className;
  const id = oldVideo.id || 'nuclear-video-' + Date.now();
  
  // יצירת אלמנט וידאו חדש
  const newVideo = document.createElement('video');
  newVideo.id = id + '-replaced';
  newVideo.srcObject = srcObject;
  newVideo.muted = muted;
  newVideo.controls = controls;
  newVideo.autoplay = true; // כפיית אוטופליי
  newVideo.playsInline = playsInline;
  newVideo.loop = loop;
  newVideo.className = className + ' nuclear-video';
  
  // סגנון בסיסי קיצוני שמוכרח לעבוד
  newVideo.style.cssText = `
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    background-color: black !important;
    z-index: 1000 !important;
  `;
  
  // זיהוי סוג המכל והתאמת סגנון בהתאם
  const isVerticalContainer = parentNode instanceof HTMLElement && 
    (parentNode.className.includes('aspect-[9/16]') || 
    (parentNode.parentElement && parentNode.parentElement.className.includes('aspect-[9/16]')));
  
  const isHorizontalContainer = parentNode instanceof HTMLElement && 
    (parentNode.className.includes('aspect-[16/9]') || 
    (parentNode.parentElement && parentNode.parentElement.className.includes('aspect-[16/9]')));
  
  if (isVerticalContainer) {
    // צופה - מילוי מקסימלי של המסך
    newVideo.style.objectFit = 'cover';
    newVideo.style.objectPosition = 'center';
    newVideo.style.transform = 'translateZ(0) scale(1.2)';
    newVideo.style.willChange = 'transform';
  } else if (isHorizontalContainer) {
    // שדר - הכלה עם שמירה על יחס רוחב-גובה
    newVideo.style.objectFit = 'contain';
  } else {
    // ברירת מחדל - מילוי עם התאמה
    newVideo.style.objectFit = 'cover';
    newVideo.style.transform = 'translateZ(0) scale(1.05)';
  }
  
  // החלפת אלמנט הווידאו הישן בחדש
  if (parentNode) {
    parentNode.replaceChild(newVideo, oldVideo);
  }
  
  // ניסיון לנגן מיד
  newVideo.play().catch((e: Error) => {
    console.warn('[תיקון קיצוני] ניגון אחרי החלפה נכשל:', e);
    
    // ניסיון נוסף עם אינטראקציית משתמש
    document.body.addEventListener('click', () => {
      newVideo.play().catch((err: Error) => 
        console.error('[תיקון קיצוני] ניסיון ניגון סופי נכשל:', err)
      );
    }, { once: true });
  });
  
  return newVideo;
}

/**
 * תיקון למסך שחור בווידאו למרות שיש סטרים תקין
 */
export function fixBlackScreen(video: HTMLVideoElement): void {
  console.log('[תיקון קיצוני] מתקן מסך שחור:', video);
  
  // כפיית סגנון קיצוני
  video.style.cssText = `
    position: absolute !important;
    inset: 0 !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    object-fit: cover !important;
    object-position: center !important;
    background-color: black !important;
    transform: translateZ(0) scale(1.2) !important;
    z-index: 100 !important;
    margin: 0 !important;
    padding: 0 !important;
  `;
  
  // עבור מכלים בפורמט 9:16, הכרח object-fit: cover
  const parentEl = video.parentElement;
  if (parentEl && (parentEl.className.includes('aspect-[9/16]') || 
      (parentEl.parentElement && parentEl.parentElement.className.includes('aspect-[9/16]')))) {
    video.classList.add('absolute', 'inset-0');
  }
  
  // כפיית ריענון תצוגה
  video.style.display = 'none';
  video.offsetHeight; // אילוץ reflow
  video.style.display = 'block';
  
  // ניסיון נוסף לנגן
  if (video.paused) {
    video.play().catch(e => console.warn('[תיקון קיצוני] ניגון במהלך תיקון מסך שחור נכשל:', e));
  }
  
  // בדיקה אם עדיין יש בעיות אחרי שנייה
  setTimeout(() => {
    // החלפה מלאה של אלמנט הווידאו לתאימות מקסימלית
    replaceVideoElement(video);
  }, 1000);
}
