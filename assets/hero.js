const hero = document.querySelector('.hero');
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
if (hero && !motion.matches && window.matchMedia('(pointer: fine)').matches) {
  hero.addEventListener('pointermove', (event) => {
    const bounds = hero.getBoundingClientRect();
    hero.style.setProperty('--move-x', `${((event.clientX - bounds.left) / bounds.width - .5) * 12}px`);
    hero.style.setProperty('--move-y', `${((event.clientY - bounds.top) / bounds.height - .5) * 12}px`);
  });
  hero.addEventListener('pointerleave', () => {
    hero.style.setProperty('--move-x', '0px');
    hero.style.setProperty('--move-y', '0px');
  });
}

const picture = document.querySelector('.hero-media img');
const counter = document.querySelector('.media-number');
const progress = document.querySelector('.slide-progress-fill');
if (picture && counter && progress) {
  const slides = [
    { src: 'assets/ar-observation.webp', alt: '机のマーカーの上にカブトムシの3Dモデルが浮かぶAR観察のイメージ' },
    { src: 'assets/ar-stag-beetle.png', alt: '机のマーカーの上にクワガタの3Dモデルが浮かぶAR観察のイメージ' }
  ];
  slides.forEach(({ src }) => { const img = new Image(); img.src = src; });
  let current = 0;
  let elapsed = 0;
  let previous = null;
  let frame = null;
  const duration = 10000;
  const tick = (now) => {
    if (previous !== null) elapsed += now - previous;
    previous = now;
    if (elapsed >= duration) {
      elapsed = 0;
      current = (current + 1) % slides.length;
      picture.src = slides[current].src;
      picture.alt = slides[current].alt;
      counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    }
    progress.style.transform = `scaleX(${elapsed / duration})`;
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
