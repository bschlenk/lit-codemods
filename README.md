# lit-codemods

A collection of codemod scripts for use with
[jscodeshift](https://github.com/facebook/jscodeshift) that helps update
lit-element projects.

This README is a work in progress.

## properties-to-decorators

Converts lit's `static get properties` method over to decorators on
class properties. The following changes are made:

- Remove `static get properties` method
- Add each configured property to the class
  - Decorated with `@property`
  - Pass same object to `@property` that was configured in `properties`
  - Convert `type` to a TypeScript type & use as type annotation
    - For `Array` and `Object`, leave a `TODO` comment since we cannot determine
      the TS type for these
  - Preserve comments
- Move assignments to properties in the constructor to the class property
- Remove the constructor if it is now empty (aside from a call to `super`)
- Add `import { property } from 'lit-element';`
  - Add to existing if possible
  - Otherwise create new import

```js
// input

import { LitElement } from 'lit-element';

export class Alert extends LitElement {
  static get properties() {
    return {
      /**
       * Documentation for dismissed.
       */
      dismissed: { type: Boolean },
    };
  }

  constructor() {
    super();
    this.dismissed = false;
  }
}

// output

import { LitElement, property } from 'lit-element';

export class Alert extends LitElement {
  /**
   * Documentation for dismissed.
   */
  @property({ type: Boolean })
  dismissed: boolean = false;
}
```
