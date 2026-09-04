/** Apply the common read-only DOM state used by Brinkwood sheets. */
export function lockSheetFormControls(html) {
  html.querySelectorAll("input, select").forEach(control => {
    control.disabled = true;
    control.setAttribute("aria-disabled", "true");
  });
  html.querySelectorAll("textarea").forEach(control => {
    control.readOnly = true;
    control.setAttribute("aria-readonly", "true");
  });
}

/** Convert one named form control into a Foundry document update. */
export function formControlUpdate(control) {
  const { name, type } = control ?? {};
  if (!name || control.disabled || (type === "radio" && !control.checked)) return null;
  const value = type === "checkbox"
    ? control.checked
    : control.multiple
      ? Array.from(control.selectedOptions, option => option.value)
      : control.value ?? control.getAttribute?.("value") ?? "";
  return { [name]: value };
}


/** Prevent native submit; the ensuing blur emits the sheet's one change event. */
export function handleActorNameEnter(event) {
  if (event.key !== "Enter" || event.isComposing) return false;
  event.preventDefault();
  event.currentTarget?.blur();
  return true;
}

/** Persist an Actor's root name once and request a Foundry-visible rerender. */
export async function persistActorNameChange(sheet, event) {
  if (!sheet?.isEditable) return false;

  const input = event?.currentTarget;
  const update = formControlUpdate(input);
  if (!update || !Object.hasOwn(update, "name")) return false;

  const name = update.name ?? "";
  if (name === sheet.document.name) return false;

  await sheet.document.update({ name }, { render: true });
  return true;
}


const documentPathQueues = new WeakMap();

/** Serialize read-modify-write interactions for one Document field path. */
export function queueDocumentPathUpdate(document, path, action) {
  if (!document || !path || typeof action !== "function") return Promise.resolve(false);

  let pathQueues = documentPathQueues.get(document);
  if (!pathQueues) {
    pathQueues = new Map();
    documentPathQueues.set(document, pathQueues);
  }

  const previous = pathQueues.get(path) ?? Promise.resolve();
  const operation = previous.catch(() => undefined).then(action);
  pathQueues.set(path, operation);

  return operation.finally(() => {
    if (pathQueues.get(path) !== operation) return;
    pathQueues.delete(path);
    if (pathQueues.size === 0) documentPathQueues.delete(document);
  });
}
