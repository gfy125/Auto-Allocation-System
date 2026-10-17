import React from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useDynamicFavicon } from '../hooks/useDynamicFavicon';
import NewGroupFormShadcn from './NewGroupFormShadcn';

interface NewGroupFormShadcnWrapperProps {
  onBack: () => void;
}

const NewGroupFormShadcnWrapper: React.FC<NewGroupFormShadcnWrapperProps> = ({ onBack }) => {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  // use dynamic favicon hook
  useDynamicFavicon();
  // if route contains edit_group_shadcn, mark as edit route
  const isEditRoute = location.pathname.includes('/student_modern/edit_group_shadcn/');
  const existingGroup = groupId ? { id: parseInt(groupId), isEditRoute } : undefined;
  return (
    <NewGroupFormShadcn 
      onBack={onBack} 
      existingGroup={existingGroup}
    />
  );
};

export default NewGroupFormShadcnWrapper;
