/**
 * Slug de formulário: minúsculo, ascii, hífen como separador — precisa bater
 * com a constraint `chk_formulario_slug_formato` da migration 0011
 * (`^[a-z0-9]+(-[a-z0-9]+)*$`, 3 a 60 caracteres).
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (marcas de combinação)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 60;
}
