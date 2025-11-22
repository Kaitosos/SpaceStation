// @ts-nocheck
class MockClassList {
  constructor(private el: MockElement) {}

  add(cls: string) {
    const parts = new Set(this.el.className.split(/\s+/).filter(Boolean));
    parts.add(cls);
    this.el.className = Array.from(parts).join(' ');
  }

  remove(cls: string) {
    const parts = this.el.className.split(/\s+/).filter(Boolean).filter((c) => c !== cls);
    this.el.className = parts.join(' ');
  }

  toggle(cls: string, force?: boolean) {
    const parts = new Set(this.el.className.split(/\s+/).filter(Boolean));
    const shouldAdd = force === undefined ? !parts.has(cls) : force;
    if (shouldAdd) {
      parts.add(cls);
    } else {
      parts.delete(cls);
    }
    this.el.className = Array.from(parts).join(' ');
  }
}

class MockElement {
  tagName: string;
  id = '';
  className = '';
  children: MockElement[] = [];
  parent: MockElement | null = null;
  textContent = '';
  value = '';
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  listeners: Record<string, ((ev: any) => void)[]> = {};
  classList: MockClassList;
  private _innerHTML = '';

  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
    this.classList = new MockClassList(this);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val: string) {
    this._innerHTML = val;
    this.children = [];
    this.textContent = '';
  }

  appendChild(child: MockElement) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: MockElement) {
    const idx = this.children.indexOf(child);
    if (idx >= 0) {
      this.children.splice(idx, 1);
      child.parent = null;
    }
    return child;
  }

  addEventListener(type: string, handler: (ev: any) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  dispatchEvent(event: any) {
    event.target = event.target || this;
    const handlers = this.listeners[event.type] || [];
    handlers.forEach((h) => h.call(this, event));
  }

  closest(selector: string): MockElement | null {
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      const classes = this.className.split(/\s+/);
      if (classes.includes(cls)) return this;
    }
    return this.parent ? this.parent.closest(selector) : null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const check = (el: MockElement) => {
      if (selector.startsWith('.') && el.className.split(/\s+/).includes(selector.slice(1))) {
        results.push(el);
      }
      for (const child of el.children) check(child);
    };
    check(this);
    return results;
  }
}

class MockDocument {
  elementsById = new Map<string, MockElement>();

  createElement(tag: string) {
    return new MockElement(tag);
  }

  createElementWithId(tag: string, id: string) {
    const el = new MockElement(tag);
    el.id = id;
    this.elementsById.set(id, el);
    return el;
  }

  getElementById(id: string) {
    return this.elementsById.get(id) || null;
  }

  querySelectorAll(selector: string) {
    const all: MockElement[] = [];
    for (const el of this.elementsById.values()) {
      all.push(...el.querySelectorAll(selector));
    }
    return all;
  }
}

export function setupMockDom() {
  const document = new MockDocument();
  const ids = [
    'hud',
    'main',
    'resources',
    'time-display',
    'build-menu',
    'grid',
    'log',
    'event-popup',
    'popup-title',
    'popup-message',
    'popup-options',
    'module-cards',
    'people-cards',
    'build-screen',
    'personnel-screen',
    'person-detail-screen',
    'main-menu',
    'person-detail-name',
    'person-detail-body',
  ];

  const buttonIds = [
    'tab-build',
    'tab-personnel',
    'person-detail-back',
    'filter-unassigned',
    'menu-toggle',
    'menu-resume',
    'menu-new',
    'menu-load',
    'menu-save',
    'menu-options',
  ];
  const inputIds = ['people-filter'];
  const selectIds = ['module-view-mode'];

  ids.forEach((id) => document.createElementWithId('div', id));
  buttonIds.forEach((id) => document.createElementWithId('button', id));
  inputIds.forEach((id) => document.createElementWithId('input', id));
  selectIds.forEach((id) => document.createElementWithId('select', id));

  const window: any = { document };
  (global as any).window = window;
  (global as any).document = document as any;
  (global as any).HTMLElement = MockElement as any;
  (global as any).Event = class {
    type: string;
    target: any;
    constructor(type: string) {
      this.type = type;
    }
  } as any;

  return { document };
}

export { MockDocument, MockElement };
