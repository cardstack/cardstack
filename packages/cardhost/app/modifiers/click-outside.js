import { modifier } from 'ember-modifier';

/*
Use this modifier if you want to call an action whenever someone clicks or focuses
on an element that is outside the one you've put the modifier on. In the example below,
clicking on the "some-other-thing" div will call the closeTheMenu function passed in.

It takes a positional arg that is the function to call, and an optional selector of an
elememnt to ignore. For example, if a button is clicked to reveal a nav menu,
you will want to ignore clicks to the button along with ignoring clicks to the nav.

```html
<div class="some-menu"  {{click-outside this.closeTheMenu ignore=".some-selector"}}>
  ...
</div>

<div class="some-other-thing">
  ...
</div>
```

See https://github.com/ember-modifier/ember-modifier to learn more about modifiers.
*/

export default modifier(function clickOutside(element, [onOutside], { ignore }) {
  const handleClickOutside = function(event) {
    // if the click is inside, ignore it
    if (element.contains(event.target)) {
      return;
    }

    let ignoreEl = document.querySelector(ignore);
    // if the click is on an ignored element, ignore it
    if (ignoreEl && ignoreEl.contains(event.target)) {
      return;
    } else {
      // otherwise, call the method
      onOutside();
    }
  };

  // register handlers
  document.querySelector('body').addEventListener('click', handleClickOutside);
  document.querySelector('body').addEventListener('focusin', handleClickOutside);

  // When the element the modifier is destroyed, tear down the events.
  return () => {
    document.querySelector('body').removeEventListener('click', handleClickOutside);
    document.querySelector('body').removeEventListener('focusin', handleClickOutside);
  };
});
