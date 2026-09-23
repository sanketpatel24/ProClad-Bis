class BisNotify extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('.bis-notify__form');
    this.input = this.querySelector('.bis-notify__input');
    this.button = this.querySelector('.bis-notify__submit');
    this.status = this.querySelector('.bis-notify__status');
    this.apiBase = (this.dataset.apiBase || '').replace(/\/$/, '');
    this.productHandle = this.dataset.productHandle || '';
    this.subscribed = false;

    this.form.addEventListener('submit', this.onSubmit);
    document.addEventListener('variant:change', this.onVariantChange);
    this.setAvailability(this.dataset.available !== 'false');
  }

  disconnectedCallback() {
    document.removeEventListener('variant:change', this.onVariantChange);
  }

  onVariantChange = (event) => {
    const variant = event.detail?.variant;
    if (!variant) return;
    this.setAvailability(Boolean(variant.available));
  };

  setAvailability(available) {
    this.hidden = available;
    if (!available && !this.subscribed) this.refreshStatus();
  }

  identity() {
    const email = (this.input.value || this.dataset.customerEmail || '').trim();
    const customerId = this.dataset.customerId || '';
    return { email, customerId };
  }

  async refreshStatus() {
    const { email, customerId } = this.identity();
    if (!email && !customerId) return;

    const params = new URLSearchParams({ productHandle: this.productHandle });
    if (customerId) params.set('customerId', customerId);
    else params.set('email', email);

    try {
      const response = await fetch(`${this.apiBase}/api/notify?${params}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      if (data.ok && data.subscribed) this.markSubscribed();
    } catch (error) {
      // Status is a convenience; the subscribe POST is idempotent.
    }
  }

  markSubscribed() {
    this.subscribed = true;
    this.button.disabled = true;
    this.setStatus("You're on the list. We'll email you when it's back.", 'success');
  }

  setStatus(message, state) {
    this.status.textContent = message;
    this.status.dataset.state = state;
  }

  onSubmit = async (event) => {
    event.preventDefault();
    if (this.subscribed || this.button.disabled) return;

    const { email, customerId } = this.identity();
    if (!customerId && !this.input.checkValidity()) {
      this.input.reportValidity();
      return;
    }

    this.button.disabled = true;
    this.setStatus('Adding you to the list…', 'pending');

    const payload = { productHandle: this.productHandle };
    if (customerId) payload.customerId = customerId;
    if (email) payload.email = email;

    try {
      const response = await fetch(`${this.apiBase}/api/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Request failed');
      }
      this.markSubscribed();
    } catch (error) {
      this.button.disabled = false;
      this.setStatus('Could not sign you up. Please try again.', 'error');
    }
  };
}

if (!customElements.get('bis-notify')) {
  customElements.define('bis-notify', BisNotify);
}
