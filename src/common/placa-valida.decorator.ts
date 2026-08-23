import { Matches } from 'class-validator'

// Formato antigo (ABC1234) ou Mercosul (ABC1D23), sempre em maiúsculas — o
// campo já deve chegar normalizado por um @Transform de uppercase antes
// desta validação rodar (mesmo critério de validarPlaca em
// assets/js/controllers/mensalistas.js e tickets.js). Sem isso, uma placa
// fora do padrão podia ser persistida via chamada direta à API e quebrar
// silenciosamente o casamento de isenção do mensalista por string exata
// (ver TicketsService.abrir).
export const MENSAGEM_PLACA_INVALIDA = 'Placa inválida. Use o formato antigo (ABC1234) ou Mercosul (ABC1D23).'

export function IsPlacaValida () {
  return Matches(/^[A-Z]{3}\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/, { message: MENSAGEM_PLACA_INVALIDA })
}
