(() => {
  function supportsDvh() {
    try {
      return CSS.supports('(height: 1dvh)');
    } catch (e) {
      return false;
    }
  }

  function setVh() {
    document.documentElement.style.setProperty(
      '--vh',
      `${window.innerHeight * 0.01}px`
    );
  }

  if (supportsDvh()) {
    // if we can set dvh, we don't need event listeners to listen for size and orientation change
    document.documentElement.style.setProperty('--vh', '1dvh');
  } else {
    setVh();
    window.addEventListener('resize', () => setVh());
    window.addEventListener('orientationchange', () => setVh());
  }
})();
