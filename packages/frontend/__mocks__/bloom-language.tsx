/**
 * `@oxy.so/bloom-language` for Inbox's jsdom suites, the boundary its Bloom
 * mocks draw: a chain is drawn as plain DOM carrying what a test reads (text,
 * the press, the accessible name, disabled and busy, the test id, a live
 * region). The language itself pulls in every Bloom family and Reanimated,
 * which cannot load over this suite's stub `react-native`.
 *
 * What a chain draws on a platform is not this file's claim: each converted
 * region is proven equal to its JSX by the codemod's parity harness (native
 * and web, light and dark), and every chain is checked by the compiler in
 * front of ts-jest (`jest.config.js`) and by `tsc`.
 */
import { createElement, Fragment, isValidElement, type ReactNode } from 'react';

type Child = Node | ReactNode;
type Binding = [unknown, (value: unknown) => void];

interface Node {
  readonly __node: string;
  readonly args: unknown[];
  readonly modifiers: Map<string, unknown[]>;
}

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && '__node' in value;

/** A node whose every modifier returns the node, keeping the last call's arguments. */
function node(type: string, args: unknown[]): Node {
  const target: Node = { __node: type, args, modifiers: new Map() };
  const chain: Node = new Proxy(target, {
    get(self, key) {
      if (typeof key === 'symbol' || key in self) return self[key as keyof Node];
      return (...values: unknown[]) => {
        self.modifiers.set(key, values);
        return chain;
      };
    },
  });
  return chain;
}

const nodeOf =
  (type: string) =>
  (...args: unknown[]) =>
    node(type, args);

export const VStack = nodeOf('VStack');
export const HStack = nodeOf('HStack');
export const ZStack = nodeOf('ZStack');
export const Group = nodeOf('Group');
export const Card = nodeOf('Card');
export const Admonition = nodeOf('Admonition');
export const Text = nodeOf('Text');
export const RawText = nodeOf('RawText');
export const Button = nodeOf('Button');
export const Icon = nodeOf('Icon');
export const Loading = nodeOf('Loading');
export const Toggle = nodeOf('Toggle');
export const Spacer = nodeOf('Spacer');
export const Divider = nodeOf('Divider');
export const Chip = nodeOf('Chip');
export const TextField = nodeOf('TextField');
export const GroupedSection = nodeOf('GroupedSection');
export const GroupedSectionItem = nodeOf('GroupedSectionItem');
export const Embed = (content: unknown) => node('Embed', [content]);
export const identity = <T,>(value: T) => value;

function draw(child: unknown, key?: string | number): ReactNode {
  if (child === null || child === undefined || child === false || child === true) return null;
  if (Array.isArray(child)) return child.map((c, i) => draw(c, i));
  if (!isNode(child)) return child as ReactNode;
  const m = (name: string) => child.modifiers.get(name)?.[0];
  const id = (m('id') as string | number | undefined) ?? key;
  const children = () => child.args.map((arg, i) => draw(arg, i));
  const a11y = {
    'aria-label': m('label') as string | undefined,
    'aria-live': m('liveRegion') as string | undefined,
    role: m('role') as string | undefined,
    'data-testid': m('testID') as string | undefined,
  };
  switch (child.__node) {
    case 'Embed': {
      const [content] = child.args;
      const drawn = typeof content === 'function' ? content((n: unknown) => draw(n)) : content;
      return isValidElement(drawn) || Array.isArray(drawn)
        ? createElement(Fragment, { key: id }, drawn as ReactNode)
        : (drawn as ReactNode);
    }
    case 'Text':
    case 'RawText':
      return createElement('span', { key: id, ...a11y }, ...children());
    case 'Button':
      return createElement(
        'button',
        {
          key: id,
          type: 'button',
          onClick: m('onPress') as (() => void) | undefined,
          disabled: Boolean(m('disabled')),
          'aria-busy': m('loading') ? true : undefined,
          ...a11y,
        },
        ...children(),
      );
    case 'Toggle': {
      const [value, set] = child.args[0] as Binding;
      return createElement('input', {
        key: id,
        type: 'checkbox',
        role: 'switch',
        checked: Boolean(value),
        onChange: (event: { target: { checked: boolean } }) => set(event.target.checked),
        disabled: Boolean(m('disabled')),
        ...a11y,
      });
    }
    case 'Loading':
      return createElement('span', { key: id, role: 'progressbar', ...a11y });
    case 'TextField': {
      // The second argument is the field's label (Bloom TextFieldInput's `label`).
      const [[value, set], label] = child.args as [Binding, string | undefined];
      const submit = m('onSubmit') as (() => void) | undefined;
      return createElement('input', {
        key: id,
        value: value as string,
        'aria-label': label,
        onChange: (event: { target: { value: string } }) => set(event.target.value),
        onKeyDown: (event: { key: string }) => {
          if (event.key === 'Enter') submit?.();
        },
        disabled: Boolean(m('disabled')),
        'data-testid': a11y['data-testid'],
      });
    }
    case 'GroupedSection':
      return createElement(
        'section',
        { key: id, ...a11y },
        m('title') === undefined
          ? null
          : createElement('h3', { key: 'title' }, m('title') as string),
        ...children(),
      );
    case 'GroupedSectionItem': {
      // A row: its title (the argument), its description and its trailing control.
      const press = m('onPress') as (() => void) | undefined;
      return createElement(
        'div',
        { key: id, 'data-node': 'GroupedSectionItem', onClick: press, ...a11y },
        ...children(),
        m('description') === undefined ? null : draw(m('description'), 'description'),
        m('trailing') === undefined ? null : draw(m('trailing'), 'trailing'),
      );
    }
    case 'Divider':
      return createElement('hr', { key: id });
    case 'Icon':
    case 'Spacer':
      return null;
    default: {
      const press = m('onPress') as (() => void) | undefined;
      return createElement(
        'div',
        {
          key: id,
          'data-node': child.__node,
          onClick: press,
          ...a11y,
          role: a11y.role ?? (press ? 'button' : undefined),
        },
        ...children(),
      );
    }
  }
}

/** What the compiler turns `toElement(chain)` into (`jest.config.js` runs it before ts-jest). */
export function LanguageRoot({ build }: { build: () => Child }): ReactNode {
  return draw(build());
}

export function toElement(child: Child, key?: string | number): ReactNode {
  return createElement(Fragment, { key }, draw(child));
}
