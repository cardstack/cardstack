import $ from 'jquery';

export default function scrollToBounds(box) {
  let midScreen = $(window).height() / 2;
  if (box && (box.bottom < midScreen || box.top > midScreen)) {
    $('html').velocity('scroll', { offset: box.top - midScreen + $('body').scrollTop() });
  }
}
