/**
 * טיפול ביחסי גודל וידאו לסגנון טיקטוק
 * הקובץ מכיל פונקציות עזר לזיהוי ושינוי יחסי גודל של וידאו
 */

/**
 * פונקציה לזיהוי יחס גודל של וידאו
 * 
 * @param width רוחב הוידאו
 * @param height גובה הוידאו
 * @returns סוג היחס: landscape, portrait, square
 */
export function detectAspectRatioType(width: number, height: number): 'landscape' | 'portrait' | 'square' {
  if (!width || !height) return 'landscape'; // ברירת מחדל
  
  const ratio = width / height;
  
  // לרוחב - יחס 1.2 ומעלה
  if (ratio >= 1.2) {
    return 'landscape';
  }
  // אנכי - יחס 0.9 ומטה
  else if (ratio <= 0.9) {
    return 'portrait';
  }
  // ריבועי - בין 0.9 ל-1.2
  else {
    return 'square';
  }
}

/**
 * מעדכן את מאפייני ה-data עבור אלמנטי הוידאו והמיכל
 * 
 * @param videoElement אלמנט הוידאו
 * @param containerElement אלמנט המיכל (אופציונלי)
 * @returns סוג היחס שזוהה
 */
export function updateAspectRatioAttributes(
  videoElement: HTMLVideoElement,
  containerElement?: HTMLElement | null
): 'landscape' | 'portrait' | 'square' {
  if (!videoElement) return 'landscape';
  
  const { videoWidth, videoHeight } = videoElement;
  const ratioType = detectAspectRatioType(videoWidth, videoHeight);
  
  // עדכון מאפיין יחס באלמנט הוידאו
  videoElement.setAttribute('data-source', ratioType);
  
  // עדכון מאפיין יחס במיכל (אם הועבר)
  if (containerElement) {
    const videoContainer = containerElement.querySelector('.tiktok-video-container');
    if (videoContainer) {
      videoContainer.setAttribute('data-ratio', ratioType);
    }
  }
  
  return ratioType;
}
