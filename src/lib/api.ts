export async function api(
  path:string,
  options?:RequestInit,
) {

  const response =
    await fetch(
      `/dentaltrack/api${path}`,
      {
        credentials:"include",

        headers:{
          "Content-Type":"application/json",
          ...options?.headers,
        },

        ...options,
      },
    );


  if(
    response.status === 401 &&
    path !== "/auth/login"
  ) {

    window.dispatchEvent(
      new CustomEvent(
        "dentaltrack:unauthorized",
      ),
    );

  }


  return response;

}
