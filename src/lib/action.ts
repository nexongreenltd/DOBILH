export type ActionResult = { ok?: boolean; error?: string; message?: string } | undefined;
export type FormAction = (prev: ActionResult, form: FormData) => Promise<ActionResult>;
