declare interface Selection {
  modify(
    alter: 'move' | 'extend',
    direction: 'forward' | 'backward' | 'left' | 'right',
    granularity: 'character' | 'word' | 'sentence' | 'line' | 'paragraph' | 'lineboundary' | 'sentenceboundary' | 'paragraphboundary' | 'documentboundary',
  ): void;
}

declare interface Window {
  ShadyDOM?: {inUse: boolean};
}
