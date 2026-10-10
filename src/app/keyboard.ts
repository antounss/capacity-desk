// Keeps the CSS variable --keyboard equal to the height of the on-screen keyboard
// whenever the keyboard overlaps the page instead of shrinking it.
//
// Phones differ here. On some, the page itself gets shorter when the keyboard opens,
// and nothing needs doing (the variable stays 0). On others the keyboard is drawn over
// the bottom of the page. The browser reports the part that is still visible as the
// "visual viewport", so the difference between the two is the space the keyboard hides.

export function trackKeyboard(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const update = () => {
    const hidden = window.innerHeight - viewport.height - viewport.offsetTop;
    // Small differences are browser toolbars or rounding, not a keyboard.
    document.documentElement.style.setProperty('--keyboard', hidden > 60 ? `${Math.round(hidden)}px` : '0px');
  };
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  update();
}
