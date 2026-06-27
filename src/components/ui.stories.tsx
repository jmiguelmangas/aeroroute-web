import type { Meta, StoryObj } from "@storybook/react-vite";
import { CloudSun, Fuel, LockKeyhole, Search, Wind } from "lucide-react";
import { useState } from "react";

import {
  Alert,
  AirportCombobox,
  Brand,
  Button,
  Capability,
  Field,
  Metric,
  Panel,
  StatusBadge,
  Tabs,
} from ".";

const meta = {
  title: "AeroRoute/Component Library",
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const BrandMarks: Story = {
  render: () => (
    <div className="story-row">
      <Brand />
      <Brand compact />
    </div>
  ),
};

export const Buttons: Story = {
  render: () => (
    <div className="story-row">
      <Button icon={Search}>Search routes</Button>
      <Button variant="secondary">Regenerate explanation</Button>
      <Button variant="ghost">Cancel</Button>
      <Button loading>Searching</Button>
      <Button disabled>Unavailable</Button>
    </div>
  ),
};

export const FormFields: Story = {
  render: () => (
    <div className="story-form">
      <Field label="Origin" hint="ICAO or city">
        <input defaultValue="MAD - Madrid Barajas" />
      </Field>
      <Field label="Objective">
        <select defaultValue="fuel">
          <option value="fuel">Minimum fuel</option>
          <option value="time">Minimum time</option>
        </select>
      </Field>
      <Field label="Unavailable weather snapshot">
        <input disabled value="No data" readOnly />
      </Field>
    </div>
  ),
};

export const AirportSearch: Story = {
  render: function AirportSearchStory() {
    const [value, setValue] = useState("MAD");
    return (
      <div className="story-form">
        <AirportCombobox label="Origin" onChange={setValue} value={value} />
      </div>
    );
  },
};

export const NavigationTabs: Story = {
  render: function TabStory() {
    const [active, setActive] = useState("map");
    return (
      <div className="story-column">
        <Tabs
          active={active}
          ariaLabel="Route views"
          items={[
            { id: "map", label: "Map" },
            { id: "profile", label: "Vertical profile" },
            { id: "winds", label: "Winds" },
            { id: "details", label: "Details" },
          ]}
          onChange={setActive}
        />
        <p className="fine-print">Selected view: {active}</p>
      </div>
    );
  },
};

export const Statuses: Story = {
  render: () => (
    <div className="story-row">
      <StatusBadge tone="success">Optimal</StatusBadge>
      <StatusBadge tone="info">MLX local</StatusBadge>
      <StatusBadge tone="warning">Synthetic</StatusBadge>
      <StatusBadge tone="danger">Unavailable</StatusBadge>
      <StatusBadge>Alternative 1</StatusBadge>
    </div>
  ),
};

export const Capabilities: Story = {
  render: () => (
    <div className="story-capabilities">
      <Capability
        icon={Fuel}
        title="Optimize"
        body="Fuel, time, emissions or cost"
      />
      <Capability
        icon={Wind}
        title="Weather"
        body="Cruise-level winds and timing"
      />
      <Capability
        icon={CloudSun}
        title="Explain"
        body="Local AI or deterministic text"
      />
      <Capability
        icon={LockKeyhole}
        title="Private"
        body="No sensitive data in the cloud"
      />
    </div>
  ),
};

export const AnalysisPanel: Story = {
  render: () => (
    <div className="story-panel">
      <Panel eyebrow="Route analysis" title="Technical details">
        <dl className="metric-grid">
          <Metric label="Distance" value="3,164 NM" />
          <Metric label="Flight time" value="442 min" />
          <Metric label="Fuel" value="49,780 kg" />
          <Metric label="Tailwind" value="38 kt" />
        </dl>
      </Panel>
    </div>
  ),
};

export const Alerts: Story = {
  render: () => (
    <div className="story-column">
      <Alert>The simulation could not be completed.</Alert>
      <Alert tone="warning">Weather data is a frozen reference snapshot.</Alert>
    </div>
  ),
};
