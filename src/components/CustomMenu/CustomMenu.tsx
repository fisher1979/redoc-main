import * as React from 'react';
import { MenuItemLi, MenuItemLabel, MenuItemTitle, MenuItemUl } from '../SideMenu/styled.elements';
import { OptionsContext } from '../OptionsProvider';

interface CustomMenuItem {
  id: string;
  label: string;
  action: string;
  htmlUrl?: string;
  htmlContent?: string;
}

interface CustomMenuProps {
  onItemClick?: (item: CustomMenuItem, htmlContent: string) => void;
}

interface CustomMenuState {
  items: CustomMenuItem[];
  activeItemId: string | null;
  loading: boolean;
}

export class CustomMenu extends React.Component<CustomMenuProps, CustomMenuState> {
  static contextType = OptionsContext;
  declare context: React.ContextType<typeof OptionsContext>;

  constructor(props: CustomMenuProps) {
    super(props);
    this.state = {
      items: [],
      activeItemId: null,
      loading: false,
    };
  }

  async componentDidMount() {
    try {
      // Load custom-menu.json from demo folder
      const response = await fetch('/custom-menu.json');
      if (response.ok) {
        const items: CustomMenuItem[] = await response.json();
        this.setState({ items });
      }
    } catch (error) {
      console.warn('Failed to load custom-menu.json:', error);
    }
  }

  handleItemClick = async (item: CustomMenuItem) => {
    this.setState({ activeItemId: item.id });

    let htmlContent = item.htmlContent || '';

    // If htmlUrl is provided and htmlContent is not, try to load from URL
    if (item.htmlUrl && !htmlContent) {
      try {
        const response = await fetch(item.htmlUrl);
        if (response.ok) {
          htmlContent = await response.text();
        }
      } catch (error) {
        console.warn(`Failed to load HTML from ${item.htmlUrl}:`, error);
        htmlContent = item.htmlContent || `<p>Failed to load content from ${item.htmlUrl}</p>`;
      }
    }

    // Call the parent callback if provided
    if (this.props.onItemClick) {
      this.props.onItemClick(item, htmlContent);
    }

    // Dispatch custom event to update content area
    window.dispatchEvent(
      new CustomEvent('custom-menu-item-clicked', {
        detail: { item, htmlContent },
      }),
    );
  };

  render() {
    const { items, activeItemId } = this.state;

    if (items.length === 0) {
      return null;
    }

    return (
      <MenuItemUl $expanded={true}>
        {items.map(item => (
          <MenuItemLi key={item.id} depth={1}>
            <MenuItemLabel
              $depth={1}
              $active={activeItemId === item.id}
              $type="section"
              onClick={() => this.handleItemClick(item)}
              onKeyDown={evt => {
                if (evt.key === 'Enter' || evt.key === ' ') {
                  this.handleItemClick(item);
                  evt.stopPropagation();
                }
              }}
              tabIndex={0}
              role="menuitem"
            >
              <MenuItemTitle>{item.label}</MenuItemTitle>
            </MenuItemLabel>
          </MenuItemLi>
        ))}
      </MenuItemUl>
    );
  }
}
