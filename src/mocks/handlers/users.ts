import { http, HttpResponse } from 'msw'

export const usersHandlers = [
  http.post('*/users/complete-registration', async ({ request }) => {
    const body = (await request.json()) as { token?: string }

    // Simula token expirado para probar el estado de error
    if (body.token === 'expired') {
      return HttpResponse.json(
        { message: 'El enlace de invitación ha expirado o ya fue utilizado.' },
        { status: 400 },
      )
    }

    // Cualquier otro token retorna éxito
    return new HttpResponse(null, { status: 201 })
  }),
]
