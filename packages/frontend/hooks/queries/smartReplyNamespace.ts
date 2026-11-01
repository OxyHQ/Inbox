import type { QueryClient } from '@tanstack/react-query';

const MOUNT_COUNTER = Symbol.for('inbox.smartReply.mountCounter.v1');
const BINDING_COUNTER = Symbol.for('inbox.smartReply.bindingCounter.v1');

function reserveCounter(target: object, key: symbol): string {
  const scoped = target as { [key: symbol]: string | undefined };
  const digits = (scoped[key] ?? '0').split('');
  let carry = 1;
  for (let index = digits.length - 1; index >= 0 && carry; index -= 1) {
    const digit = digits[index];
    if (digit === '9') digits[index] = '0';
    else {
      digits[index] = String(Number(digit) + 1);
      carry = 0;
    }
  }
  if (carry) digits.unshift('1');
  const next = digits.join('');
  Object.defineProperty(scoped, key, { value: next, writable: true, enumerable: false });
  return next;
}

/** Reserve a memory-only key without reusing one while the QueryClient lives. */
export function reserveSmartReplyNamespace(client: QueryClient): string {
  return reserveCounter(client, MOUNT_COUNTER);
}

/** Distinguish runtime and QueryClient bindings, including after a module reload. */
export function reserveSmartReplyBinding(): string {
  return reserveCounter(globalThis, BINDING_COUNTER);
}
