import { queryOptions } from "@tanstack/react-query";
import { getCompanies, getCompany, getQuarterDetail } from "~/server/db";

export const companiesQueryOptions = () =>
  queryOptions({
    queryKey: ["companies"],
    queryFn: () => getCompanies(),
  });

export const companyQueryOptions = (ticker: string) =>
  queryOptions({
    queryKey: ["company", ticker],
    queryFn: () => getCompany({ data: ticker }),
  });

export const quarterDetailQueryOptions = (
  ticker: string,
  year: number,
  quarter: number
) =>
  queryOptions({
    queryKey: ["quarterDetail", ticker, year, quarter],
    queryFn: () =>
      getQuarterDetail({ data: { ticker, year, quarter } }),
  });
