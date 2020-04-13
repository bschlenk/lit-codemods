import { LitElement } from 'lit-element';

export class Alert extends LitElement {
  static get properties() {
    return {
      /**
       * Documentation for dismissed.
       */
      dismissed: { type: Boolean, reflect: true },

      /**
       * Documentation for closeType.
       */
      closeType: { type: String, reflect: true, attribute: 'close-type' },
    };
  }

  constructor() {
    super();

    this.dismissed = false;
  }
}
