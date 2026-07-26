import { backend } from "@/services/backendAdapter";

// Thin helper to invoke a Base44 backend function from the frontend.
// invoke() returns the raw axios response; the function's JSON is on `.data`.
// It throws on non-2xx; callers catch and read err.response?.data?.error.
export async function callFn(name, payload) {
  const res = await backend.functions.invoke(name, payload);
  return res.data;
}