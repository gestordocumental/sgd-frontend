// "ssf" (SheetJS's standalone number-format engine) ships no types and has
// no @types package on npm — this is the minimal surface DetailWorkflowDialog uses.
declare module 'ssf' {
  const SSF: { format: (fmt: string | number, value: unknown) => string };
  export default SSF;
}
