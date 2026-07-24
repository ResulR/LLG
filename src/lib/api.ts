export async function api(
  path: string,
  options?: RequestInit,
) {
  const response = await fetch(`/dentaltrack/api${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  return response;
}
