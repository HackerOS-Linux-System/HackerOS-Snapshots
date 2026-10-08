export function installSilverCompat(): void {
  let proto: object | null = Object.getPrototypeOf(document.createElement('template'));
  while (proto) {
    const d = Object.getOwnPropertyDescriptor(proto, 'innerHTML');
    if (d && d.set) {
      const orig = d.set;
      Object.defineProperty(proto, 'innerHTML', {
        ...d,
        set(this: unknown, v: unknown) {
          orig.call(this, typeof v === 'string' ? v.split('<!>').join('<!---->') : v);
        },
      });
      return;
    }
    proto = Object.getPrototypeOf(proto);
  }
}
installSilverCompat();
  
