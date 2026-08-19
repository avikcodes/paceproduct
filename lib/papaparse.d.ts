declare module "papaparse" {
  export interface ParseError {
    type: string;
    code: string;
    message: string;
    row?: number;
  }

  export interface ParseMeta {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
    fields?: string[];
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  export interface ParseConfig<T> {
    header?: boolean;
    skipEmptyLines?: boolean | "greedy";
    complete?: (results: ParseResult<T>, file?: File) => void;
    error?: (error: Error, file?: File) => void;
  }

  export function parse<T>(input: File, config: ParseConfig<T>): void;
  export function parse<T>(input: string, config?: ParseConfig<T>): ParseResult<T>;
}
