import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Table } from "./Table";

const meta: Meta<typeof Table> = {
  title: "Components/Table",
  component: Table,
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj<typeof Table>;

export const Default: Story = {
  render: () => (
    <Table className="min-w-[420px]">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="py-2 pr-2">Request</th>
          <th className="py-2 pr-2">Status</th>
          <th className="py-2 pr-6 text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-slate-100">
          <td className="py-2 pr-2 font-mono">CCF-20260903-0265</td>
          <td className="py-2 pr-2">Draft</td>
          <td className="py-2 pr-6 text-right font-mono">$12.50</td>
        </tr>
        <tr className="border-b border-slate-100">
          <td className="py-2 pr-2 font-mono">CCF-20260902-0239</td>
          <td className="py-2 pr-2">Awaiting approval</td>
          <td className="py-2 pr-6 text-right font-mono">$50.00</td>
        </tr>
      </tbody>
    </Table>
  ),
};
