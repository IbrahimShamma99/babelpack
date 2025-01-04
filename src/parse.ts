import swc from "@swc/core";

export const parse = async (source: string) => {
  return await swc.parseFileSync(source);
};
